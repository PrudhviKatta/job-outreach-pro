// /api/campaigns/start-clean/route.js - Simple, reliable campaign start
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { sendEmail, replaceVariables, decryptPassword } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function POST(request) {
  try {
    const { templateId, resumeId, recipients } = await request.json();

    console.log(`🚀 Starting clean campaign: ${recipients.length} recipients`);

    // Get user authentication
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.replace("Bearer ", "");

    if (!token) {
      const cookies = request.headers.get("cookie");
      if (cookies) {
        const authCookie = cookies
          .split(";")
          .find((c) => c.trim().startsWith("sb-"))
          ?.split("=")[1];
        if (authCookie) {
          try {
            const parsed = JSON.parse(decodeURIComponent(authCookie));
            token = parsed.access_token;
          } catch (e) {
            console.log("Could not parse auth cookie");
          }
        }
      }
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let user;
    if (token) {
      const { data: userData, error: userError } = await supabase.auth.getUser(
        token
      );
      if (!userError && userData?.user) {
        user = userData.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Validate inputs
    if (!templateId || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (recipients.length > 500) {
      return NextResponse.json(
        { success: false, error: "Maximum 500 recipients allowed" },
        { status: 400 }
      );
    }

    // Get template
    const { data: template, error: templateError } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .single();

    if (templateError) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // Get resume (if provided)
    let resume = null;
    if (resumeId) {
      const { data: resumeData, error: resumeError } = await supabaseAdmin
        .from("resumes")
        .select("*")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();

      if (resumeError) {
        console.warn("Resume not found, continuing without attachment");
      } else {
        resume = resumeData;
      }
    }

    // Get user's email settings
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select(
        "sender_email, encrypted_app_password, email_configured, send_delay_min, send_delay_max"
      )
      .eq("user_id", user.id)
      .single();

    if (settingsError || !userSettings?.email_configured) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Email not configured. Please configure your email settings first.",
        },
        { status: 400 }
      );
    }

    // Create campaign in database
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("email_campaigns")
      .insert({
        user_id: user.id,
        name: `Campaign - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        template_id: templateId,
        resume_id: resumeId || null,
        status: "sending",
        total_recipients: recipients.length,
        sent_count: 0,
        failed_count: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (campaignError) {
      console.error("Campaign creation error:", campaignError);
      return NextResponse.json(
        { success: false, error: "Failed to create campaign" },
        { status: 500 }
      );
    }

    // Add recipients to database
    const recipientData = recipients.map((recipient) => ({
      campaign_id: campaign.id,
      name: recipient.name || "Unknown",
      email: recipient.email,
      company: recipient.company || null,
      position: recipient.position || null,
      status: "pending",
    }));

    const { error: recipientsError } = await supabaseAdmin
      .from("campaign_recipients")
      .insert(recipientData);

    if (recipientsError) {
      console.error("Recipients creation error:", recipientsError);
      // Try to cleanup the campaign
      await supabaseAdmin
        .from("email_campaigns")
        .delete()
        .eq("id", campaign.id);
      return NextResponse.json(
        { success: false, error: "Failed to save recipients" },
        { status: 500 }
      );
    }

    console.log(`✅ Campaign created: ${campaign.id}`);

    // Start background email processing (don't await - let it run in background)
    processEmailsInBackground(
      campaign.id,
      template,
      resume,
      userSettings,
      user,
      supabaseAdmin
    );

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      message: "Campaign started successfully",
    });
  } catch (error) {
    console.error("Start campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Background email processing function
async function processEmailsInBackground(
  campaignId,
  template,
  resume,
  userSettings,
  user,
  supabaseAdmin
) {
  try {
    console.log(
      `📧 Starting background processing for campaign: ${campaignId}`
    );

    // Decrypt password
    let appPassword;
    try {
      appPassword = decryptPassword(userSettings.encrypted_app_password);
    } catch (error) {
      console.error("Password decryption error:", error);
      await supabaseAdmin
        .from("email_campaigns")
        .update({ status: "failed" })
        .eq("id", campaignId);
      return;
    }

    // Get pending recipients
    const { data: pendingRecipients, error: recipientsError } =
      await supabaseAdmin
        .from("campaign_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (recipientsError) {
      console.error("Error fetching recipients:", recipientsError);
      return;
    }

    console.log(`📋 Processing ${pendingRecipients.length} recipients`);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < pendingRecipients.length; i++) {
      const recipient = pendingRecipients[i];

      try {
        // Check if campaign was stopped
        const { data: currentCampaign } = await supabaseAdmin
          .from("email_campaigns")
          .select("status")
          .eq("id", campaignId)
          .single();

        if (currentCampaign?.status !== "sending") {
          console.log(`Campaign ${campaignId} was stopped`);
          break;
        }

        // Update recipient status to 'sending'
        await supabaseAdmin
          .from("campaign_recipients")
          .update({ status: "sending" })
          .eq("id", recipient.id);

        // Prepare email content
        const trackingId = generateTrackingId();
        const variables = {
          recruiterName: recipient.name,
          name: recipient.name,
          email: recipient.email,
          company: recipient.company || "",
          position: recipient.position || "",
          myName: user.user_metadata?.name || user.email,
          myEmail: user.email,
        };

        const subject = replaceVariables(template.subject, variables);
        const body = replaceVariables(template.body, variables);

        // Send email
        const emailResult = await sendEmail({
          to: recipient.email,
          subject,
          body,
          attachments: resume
            ? [
                {
                  filename: resume.file_name,
                  path: resume.file_url,
                },
              ]
            : [],
          trackingId,
          senderEmail: userSettings.sender_email,
          appPassword,
        });

        if (emailResult.success) {
          // Mark as sent
          await supabaseAdmin
            .from("campaign_recipients")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              tracking_id: trackingId,
            })
            .eq("id", recipient.id);

          sentCount++;
          console.log(
            `✅ Sent to ${recipient.email} (${sentCount}/${pendingRecipients.length})`
          );
        } else {
          // Mark as failed
          await supabaseAdmin
            .from("campaign_recipients")
            .update({
              status: "failed",
              error_message: emailResult.error,
            })
            .eq("id", recipient.id);

          failedCount++;
          console.log(
            `❌ Failed to send to ${recipient.email}: ${emailResult.error}`
          );
        }

        // Update campaign counts
        await supabaseAdmin
          .from("email_campaigns")
          .update({
            sent_count: sentCount,
            failed_count: failedCount,
          })
          .eq("id", campaignId);

        // Add delay between emails (except for last one)
        if (i < pendingRecipients.length - 1) {
          const minDelay = (userSettings.send_delay_min || 8) * 1000;
          const maxDelay = (userSettings.send_delay_max || 20) * 1000;
          const randomDelay =
            Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          console.log(`⏱️ Waiting ${randomDelay / 1000}s before next email...`);
          await new Promise((resolve) => setTimeout(resolve, randomDelay));
        }
      } catch (error) {
        console.error(`Error processing recipient ${recipient.email}:`, error);

        // Mark as failed
        await supabaseAdmin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", recipient.id);

        failedCount++;

        // Update campaign counts
        await supabaseAdmin
          .from("email_campaigns")
          .update({
            sent_count: sentCount,
            failed_count: failedCount,
          })
          .eq("id", campaignId);
      }
    }

    // Mark campaign as completed
    await supabaseAdmin
      .from("email_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq("id", campaignId);

    console.log(
      `🎉 Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`
    );
  } catch (error) {
    console.error(`Campaign ${campaignId} error:`, error);
    await supabaseAdmin
      .from("email_campaigns")
      .update({ status: "failed" })
      .eq("id", campaignId);
  }
}

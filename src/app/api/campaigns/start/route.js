// src/app/api/campaigns/start/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { sendEmail, replaceVariables, decryptPassword } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function POST(request) {
  try {
    const { campaignId } = await request.json();

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

    // Get campaign with all details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("email_campaigns")
      .select(
        `
        *,
        templates (*),
        resumes (*),
        campaign_recipients (*)
      `
      )
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Campaign is not in draft status" },
        { status: 400 }
      );
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

    // Decrypt password
    let appPassword;
    try {
      appPassword = decryptPassword(userSettings.encrypted_app_password);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Error decrypting email credentials" },
        { status: 500 }
      );
    }

    // Update campaign status to 'sending'
    await supabaseAdmin
      .from("email_campaigns")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    // Start background email sending process
    processEmailCampaign(
      campaignId,
      campaign,
      userSettings,
      appPassword,
      user,
      supabaseAdmin
    );

    return NextResponse.json({
      success: true,
      message: "Campaign started successfully",
      campaignId,
    });
  } catch (error) {
    console.error("Start campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Background process to send emails
async function processEmailCampaign(
  campaignId,
  campaign,
  userSettings,
  appPassword,
  user,
  supabaseAdmin
) {
  try {
    console.log(`Starting email campaign: ${campaignId}`);

    const pendingRecipients = campaign.campaign_recipients.filter(
      (r) => r.status === "pending"
    );

    for (let i = 0; i < pendingRecipients.length; i++) {
      const recipient = pendingRecipients[i];

      // Check if campaign is still in 'sending' status (could be paused)
      const { data: currentCampaign } = await supabaseAdmin
        .from("email_campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (currentCampaign?.status !== "sending") {
        console.log(`Campaign ${campaignId} paused or stopped`);
        break;
      }

      // Update recipient status to 'sending'
      await supabaseAdmin
        .from("campaign_recipients")
        .update({ status: "sending" })
        .eq("id", recipient.id);

      try {
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

        const subject = replaceVariables(campaign.templates.subject, variables);
        const body = replaceVariables(campaign.templates.body, variables);

        // Send email
        const emailResult = await sendEmail({
          to: recipient.email,
          subject,
          body,
          attachments: campaign.resumes
            ? [
                {
                  filename: campaign.resumes.file_name,
                  path: campaign.resumes.file_url,
                },
              ]
            : [],
          trackingId,
          senderEmail: userSettings.sender_email,
          appPassword,
        });

        if (emailResult.success) {
          // Update recipient as sent
          await supabaseAdmin
            .from("campaign_recipients")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              tracking_id: trackingId,
            })
            .eq("id", recipient.id);

          // Save to outreach history
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .upsert(
              {
                user_id: user.id,
                name: recipient.name,
                email: recipient.email,
                company: recipient.company,
                position: recipient.position,
              },
              { onConflict: "user_id,email" }
            )
            .select()
            .single();

          await supabaseAdmin.from("outreach_history").insert({
            user_id: user.id,
            contact_id: contact?.id,
            template_id: campaign.template_id,
            resume_id: campaign.resume_id,
            type: "email",
            subject,
            content: body,
            status: "sent",
            tracking_id: trackingId,
          });
        } else {
          // Mark as failed
          await supabaseAdmin
            .from("campaign_recipients")
            .update({
              status: "failed",
              error_message: emailResult.error,
            })
            .eq("id", recipient.id);
        }
      } catch (error) {
        console.error(`Error sending to ${recipient.email}:`, error);
        await supabaseAdmin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", recipient.id);
      }

      // Add delay between emails (except for last one)
      if (i < pendingRecipients.length - 1) {
        const minDelay = (userSettings.send_delay_min || 8) * 1000;
        const maxDelay = (userSettings.send_delay_max || 20) * 1000;
        const randomDelay =
          Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        console.log(
          `Campaign ${campaignId}: Waiting ${
            randomDelay / 1000
          } seconds before next email...`
        );
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }
    }

    // Mark campaign as completed
    await supabaseAdmin
      .from("email_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    console.log(`Campaign ${campaignId} completed`);
  } catch (error) {
    console.error(`Campaign ${campaignId} error:`, error);
    await supabaseAdmin
      .from("email_campaigns")
      .update({ status: "failed" })
      .eq("id", campaignId);
  }
}

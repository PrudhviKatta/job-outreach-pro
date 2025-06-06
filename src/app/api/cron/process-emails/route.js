// src/app/api/cron/process-emails/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, replaceVariables, decryptPassword } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function GET(request) {
  try {
    console.log("🔄 Queue processor started at:", new Date().toISOString());

    // Create admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Get active campaigns that need processing
    const { data: activeCampaigns, error: campaignsError } = await supabaseAdmin
      .from("email_campaigns")
      .select(
        `
        id,
        user_id,
        name,
        status,
        template_id,
        resume_id,
        last_processed_at,
        current_batch_size,
        templates (*),
        resumes (*)
      `
      )
      .eq("status", "sending")
      .order("last_processed_at", { ascending: true, nullsFirst: true })
      .limit(5); // Process max 5 campaigns per run

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      throw campaignsError;
    }

    if (!activeCampaigns || activeCampaigns.length === 0) {
      console.log("📭 No active campaigns to process");
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No campaigns to process",
      });
    }

    console.log(`📋 Found ${activeCampaigns.length} active campaigns`);

    let totalEmailsProcessed = 0;
    const processingResults = [];

    // Process each campaign
    for (const campaign of activeCampaigns) {
      try {
        console.log(
          `🎯 Processing campaign: ${campaign.name} (${campaign.id})`
        );

        // Get user's email settings
        const { data: userSettings, error: settingsError } = await supabaseAdmin
          .from("user_settings")
          .select(
            "sender_email, encrypted_app_password, send_delay_min, send_delay_max"
          )
          .eq("user_id", campaign.user_id)
          .single();

        if (settingsError || !userSettings?.sender_email) {
          console.error(
            `❌ User settings not found for campaign ${campaign.id}`
          );
          continue;
        }

        // Calculate batch size based on user's delay settings
        const avgDelay =
          (userSettings.send_delay_min + userSettings.send_delay_max) / 2;
        const maxTimePerBatch = 50; // seconds (leave buffer for cron)
        const batchSize = Math.max(
          1,
          Math.min(10, Math.floor(maxTimePerBatch / avgDelay))
        );

        console.log(
          `📊 Batch size for campaign ${campaign.id}: ${batchSize} emails (avg delay: ${avgDelay}s)`
        );

        // Get pending recipients for this campaign
        const { data: pendingRecipients, error: recipientsError } =
          await supabaseAdmin
            .from("campaign_recipients")
            .select("*")
            .eq("campaign_id", campaign.id)
            .eq("status", "pending")
            .limit(batchSize);

        if (recipientsError) {
          console.error(
            `❌ Error fetching recipients for campaign ${campaign.id}:`,
            recipientsError
          );
          continue;
        }

        if (!pendingRecipients || pendingRecipients.length === 0) {
          console.log(
            `✅ Campaign ${campaign.id} completed - no pending recipients`
          );

          // Mark campaign as completed
          await supabaseAdmin
            .from("email_campaigns")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              last_processed_at: new Date().toISOString(),
            })
            .eq("id", campaign.id);

          processingResults.push({
            campaignId: campaign.id,
            status: "completed",
            emailsProcessed: 0,
          });
          continue;
        }

        console.log(
          `📨 Processing ${pendingRecipients.length} recipients for campaign ${campaign.id}`
        );

        // Decrypt user's app password
        let appPassword;
        try {
          appPassword = decryptPassword(userSettings.encrypted_app_password);
        } catch (error) {
          console.error(
            `❌ Failed to decrypt password for campaign ${campaign.id}`
          );
          continue;
        }

        // Process recipients in this batch
        let successCount = 0;
        let failCount = 0;

        for (const recipient of pendingRecipients) {
          try {
            console.log(`📧 Sending to: ${recipient.email}`);

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
              myName: `User_${campaign.user_id}`, // We don't have user name in campaigns
              myEmail: userSettings.sender_email,
            };

            const subject = replaceVariables(
              campaign.templates.subject,
              variables
            );
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
              // Mark as sent
              await supabaseAdmin
                .from("campaign_recipients")
                .update({
                  status: "sent",
                  sent_at: new Date().toISOString(),
                  tracking_id: trackingId,
                })
                .eq("id", recipient.id);

              successCount++;
              console.log(`✅ Sent to ${recipient.email}`);
            } else {
              // Mark as failed
              await supabaseAdmin
                .from("campaign_recipients")
                .update({
                  status: "failed",
                  error_message: emailResult.error,
                })
                .eq("id", recipient.id);

              failCount++;
              console.log(
                `❌ Failed to send to ${recipient.email}: ${emailResult.error}`
              );
            }

            // Add delay between emails (respecting user settings)
            if (
              pendingRecipients.indexOf(recipient) <
              pendingRecipients.length - 1
            ) {
              const minDelay = userSettings.send_delay_min * 1000;
              const maxDelay = userSettings.send_delay_max * 1000;
              const randomDelay =
                Math.floor(Math.random() * (maxDelay - minDelay + 1)) +
                minDelay;

              console.log(
                `⏱️ Waiting ${randomDelay / 1000}s before next email...`
              );
              await new Promise((resolve) => setTimeout(resolve, randomDelay));
            }
          } catch (error) {
            console.error(
              `❌ Error processing recipient ${recipient.email}:`,
              error
            );

            // Mark as failed
            await supabaseAdmin
              .from("campaign_recipients")
              .update({
                status: "failed",
                error_message: error.message,
              })
              .eq("id", recipient.id);

            failCount++;
          }
        }

        // Update campaign's last processed time and batch size
        await supabaseAdmin
          .from("email_campaigns")
          .update({
            last_processed_at: new Date().toISOString(),
            current_batch_size: batchSize,
          })
          .eq("id", campaign.id);

        totalEmailsProcessed += successCount + failCount;

        processingResults.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          emailsProcessed: successCount + failCount,
          successful: successCount,
          failed: failCount,
          batchSize: batchSize,
        });

        console.log(
          `📊 Campaign ${campaign.id} batch complete: ${successCount} sent, ${failCount} failed`
        );
      } catch (error) {
        console.error(`❌ Error processing campaign ${campaign.id}:`, error);
        processingResults.push({
          campaignId: campaign.id,
          error: error.message,
        });
      }
    }

    console.log(
      `🎉 Queue processing complete. Total emails processed: ${totalEmailsProcessed}`
    );

    return NextResponse.json({
      success: true,
      processed: totalEmailsProcessed,
      campaigns: processingResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Queue processor error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST method for manual testing (development only)
export async function POST(request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Manual trigger not allowed in production" },
      { status: 403 }
    );
  }

  return GET(request);
}

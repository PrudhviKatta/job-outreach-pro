// src/app/api/cron/process-emails/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, replaceVariables, decryptPassword } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function GET(request) {
  try {
    // Verify cron secret for production
    const cronSecret = request.headers.get("x-cron-secret");
    if (
      process.env.NODE_ENV === "production" &&
      cronSecret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔄 Queue processor started at:", new Date().toISOString());

    // Get active campaigns
    const activeCampaigns = await prisma.emailCampaign.findMany({
      where: { status: "sending" },
      include: {
        template: true,
        resume: true,
      },
      orderBy: { lastProcessedAt: { sort: "asc", nulls: "first" } },
      take: 5,
    });

    if (activeCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No campaigns to process",
      });
    }

    let totalProcessed = 0;
    const results = [];

    for (const campaign of activeCampaigns) {
      try {
        const userSettings = await prisma.userSettings.findUnique({
          where: { userId: campaign.userId },
        });

        if (!userSettings?.senderEmail || !userSettings?.encryptedAppPassword) {
          continue;
        }

        let appPassword;
        try {
          appPassword = decryptPassword(userSettings.encryptedAppPassword);
        } catch {
          continue;
        }

        const batchSize = 75;

        const pendingRecipients = await prisma.campaignRecipient.findMany({
          where: { campaignId: campaign.id, status: "pending" },
          take: batchSize,
        });

        if (pendingRecipients.length === 0) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: {
              status: "completed",
              completedAt: new Date(),
              lastProcessedAt: new Date(),
            },
          });
          results.push({ campaignId: campaign.id, status: "completed" });
          continue;
        }

        let successCount = 0;
        let failCount = 0;

        for (const recipient of pendingRecipients) {
          try {
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "sending" },
            });

            const trackingId = generateTrackingId();
            const variables = {
              recruiterName: recipient.name,
              name: recipient.name,
              email: recipient.email,
              company: recipient.company || "",
              position: recipient.position || "",
              myName: userSettings.senderEmail.split("@")[0],
              myEmail: userSettings.senderEmail,
            };

            const subject = replaceVariables(
              campaign.template.subject,
              variables
            );
            const body = replaceVariables(campaign.template.body, variables);

            const emailResult = await sendEmail({
              to: recipient.email,
              subject,
              body,
              attachments: campaign.resume
                ? [
                  {
                    filename: campaign.resume.fileName,
                    path: require("path").join(process.cwd(), campaign.resume.fileUrl),
                  },
                ]
                : [],
              trackingId,
              senderEmail: userSettings.senderEmail,
              appPassword,
            });

            if (emailResult.success) {
              await prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: "sent",
                  sentAt: new Date(),
                  trackingId,
                },
              });
              successCount++;
            } else {
              await prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: "failed",
                  errorMessage: emailResult.error,
                },
              });
              failCount++;
            }

            // Delay between emails
            const minDelay = (userSettings.sendDelayMin || 8) * 1000;
            const maxDelay = (userSettings.sendDelayMax || 20) * 1000;
            const randomDelay =
              Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            await new Promise((r) => setTimeout(r, randomDelay));
          } catch (err) {
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "failed", errorMessage: err.message },
            });
            failCount++;
          }
        }

        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            sentCount: { increment: successCount },
            failedCount: { increment: failCount },
            lastProcessedAt: new Date(),
            currentBatchSize: batchSize,
          },
        });

        totalProcessed += successCount + failCount;
        results.push({
          campaignId: campaign.id,
          sent: successCount,
          failed: failCount,
        });
      } catch (err) {
        console.error(`Error processing campaign ${campaign.id}:`, err);
        results.push({ campaignId: campaign.id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      campaigns: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Queue processor error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

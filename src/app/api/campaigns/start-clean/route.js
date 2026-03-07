// src/app/api/campaigns/start-clean/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";
import { sendEmail, replaceVariables, decryptPassword } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { templateId, resumeId, recipients, campaignName } =
      await request.json();

    if (!templateId || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "Template and recipients are required" },
        { status: 400 }
      );
    }

    if (recipients.length > 500) {
      return NextResponse.json(
        { success: false, error: "Maximum 500 recipients per campaign" },
        { status: 400 }
      );
    }

    // Fetch template
    const template = await prisma.template.findFirst({
      where: { id: templateId, userId: user.id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // Fetch resume if selected
    let resume = null;
    if (resumeId) {
      resume = await prisma.resume.findFirst({
        where: { id: resumeId, userId: user.id },
      });
    }

    // Fetch user email settings
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!userSettings?.emailConfigured || !userSettings?.senderEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Email not configured. Please set up your email in Settings.",
        },
        { status: 400 }
      );
    }

    // Create campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId: user.id,
        name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        templateId,
        resumeId: resumeId || null,
        status: "sending",
        totalRecipients: recipients.length,
        startedAt: new Date(),
      },
    });

    // Save recipients
    await prisma.campaignRecipient.createMany({
      data: recipients.map((r) => ({
        campaignId: campaign.id,
        name: r.name || "Unknown",
        email: r.email,
        company: r.company || null,
        position: r.position || null,
        status: "pending",
      })),
    });

    // Process emails in background (fire and forget)
    processEmailsInBackground(
      campaign.id,
      user,
      template,
      resume,
      userSettings
    );

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      message: `Campaign started with ${recipients.length} recipients`,
    });
  } catch (error) {
    console.error("Start campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function processEmailsInBackground(
  campaignId,
  user,
  template,
  resume,
  userSettings
) {
  try {
    let appPassword;
    try {
      appPassword = decryptPassword(userSettings.encryptedAppPassword);
    } catch (err) {
      console.error("Failed to decrypt password:", err);
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: "failed" },
      });
      return;
    }

    const pendingRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: "pending" },
    });

    for (const recipient of pendingRecipients) {
      // Check if campaign was stopped
      const campaign = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });

      if (
        campaign?.status === "stopped" ||
        campaign?.status === "cancelled"
      ) {
        console.log(`Campaign ${campaignId} was stopped`);
        return;
      }

      try {
        // Update to sending
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
          myName: user.name || user.email,
          myEmail: userSettings.senderEmail,
        };

        const subject = replaceVariables(template.subject, variables);
        const body = replaceVariables(template.body, variables);

        const emailResult = await sendEmail({
          to: recipient.email,
          subject,
          body,
          attachments: resume
            ? [{ filename: resume.fileName, path: require("path").join(process.cwd(), resume.fileUrl) }]
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

          await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          });

          // Save to outreach history
          const contact = await prisma.contact.upsert({
            where: {
              userId_email: {
                userId: user.id,
                email: recipient.email,
              },
            },
            update: {
              name: recipient.name,
              company: recipient.company,
              position: recipient.position,
            },
            create: {
              userId: user.id,
              name: recipient.name,
              email: recipient.email,
              company: recipient.company,
              position: recipient.position,
            },
          });

          await prisma.outreachHistory.create({
            data: {
              userId: user.id,
              contactId: contact.id,
              templateId: template.id,
              resumeId: resume?.id || null,
              type: "email",
              subject,
              content: body,
              status: "sent",
              trackingId,
            },
          });
        } else {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "failed",
              errorMessage: emailResult.error,
            },
          });

          await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          });
        }
      } catch (err) {
        console.error(`Error sending to ${recipient.email}:`, err);
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "failed",
            errorMessage: err.message,
          },
        });
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
      }

      // Random delay between emails
      const minDelay = (userSettings.sendDelayMin || 8) * 1000;
      const maxDelay = (userSettings.sendDelayMax || 20) * 1000;
      const randomDelay =
        Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }

    // Mark campaign as completed
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: "completed",
        completedAt: new Date(),
        lastProcessedAt: new Date(),
      },
    });

    console.log(`Campaign ${campaignId} completed`);
  } catch (error) {
    console.error(`Background processing error for ${campaignId}:`, error);
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    });
  }
}

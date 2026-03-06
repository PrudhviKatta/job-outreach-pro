// src/app/api/campaigns/draft/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

// Save or update a draft campaign
export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { campaignId, templateId, resumeId, recipients, campaignName } =
      await request.json();

    if (campaignId) {
      // Update existing draft
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id: campaignId, userId: user.id, status: "draft" },
      });

      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Draft campaign not found" },
          { status: 404 }
        );
      }

      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          templateId: templateId || campaign.templateId,
          resumeId: resumeId || campaign.resumeId,
          name: campaignName || campaign.name,
          totalRecipients: recipients?.length || campaign.totalRecipients,
        },
      });

      // Update recipients if provided
      if (recipients && recipients.length > 0) {
        await prisma.campaignRecipient.deleteMany({
          where: { campaignId },
        });

        await prisma.campaignRecipient.createMany({
          data: recipients.map((r) => ({
            campaignId,
            name: r.name || "Unknown",
            email: r.email,
            company: r.company || null,
            position: r.position || null,
            status: "pending",
          })),
        });
      }

      return NextResponse.json({
        success: true,
        campaignId,
        message: "Draft updated",
      });
    } else {
      // Create new draft
      const campaign = await prisma.emailCampaign.create({
        data: {
          userId: user.id,
          name: campaignName || `Draft ${new Date().toLocaleDateString()}`,
          templateId: templateId || null,
          resumeId: resumeId || null,
          status: "draft",
          totalRecipients: recipients?.length || 0,
        },
      });

      if (recipients && recipients.length > 0) {
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
      }

      return NextResponse.json({
        success: true,
        campaignId: campaign.id,
        message: "Draft created",
      });
    }
  } catch (error) {
    console.error("Draft campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Load a draft campaign
export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (campaignId) {
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id: campaignId, userId: user.id },
        include: {
          recipients: true,
          template: true,
          resume: true,
        },
      });

      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Campaign not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, campaign });
    }

    // List all drafts
    const drafts = await prisma.emailCampaign.findMany({
      where: { userId: user.id, status: "draft" },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, drafts });
  } catch (error) {
    console.error("Get draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

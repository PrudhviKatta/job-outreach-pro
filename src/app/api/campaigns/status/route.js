// src/app/api/campaigns/status/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId: user.id },
      include: {
        recipients: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const sent = campaign.recipients.filter((r) => r.status === "sent").length;
    const failed = campaign.recipients.filter((r) => r.status === "failed").length;
    const pending = campaign.recipients.filter(
      (r) => r.status === "pending" || r.status === "sending"
    ).length;

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      },
      progress: { sent, failed, pending, total: campaign.totalRecipients },
      recipients: campaign.recipients.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        company: r.company,
        position: r.position,
        status: r.status,
        sentAt: r.sentAt,
        errorMessage: r.errorMessage,
      })),
    });
  } catch (error) {
    console.error("Campaign status error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST for pause/resume/cancel actions
export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { campaignId, action } = await request.json();

    if (!campaignId || !action) {
      return NextResponse.json(
        { success: false, error: "Campaign ID and action are required" },
        { status: 400 }
      );
    }

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId: user.id },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const validActions = {
      pause: "paused",
      resume: "sending",
      cancel: "cancelled",
    };

    const newStatus = validActions[action];
    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: newStatus },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign ${action}d successfully`,
    });
  } catch (error) {
    console.error("Campaign action error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

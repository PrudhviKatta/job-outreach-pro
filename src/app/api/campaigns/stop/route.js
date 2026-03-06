// src/app/api/campaigns/stop/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { campaignId } = await request.json();

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const result = await prisma.emailCampaign.updateMany({
      where: {
        id: campaignId,
        userId: user.id,
        status: { in: ["sending", "paused", "draft"] },
      },
      data: { status: "stopped" },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: "Campaign not found or already stopped" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign stopped successfully",
    });
  } catch (error) {
    console.error("Stop campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

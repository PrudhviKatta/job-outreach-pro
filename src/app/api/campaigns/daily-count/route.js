// src/app/api/campaigns/daily-count/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // Get today's start (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.outreachHistory.count({
      where: {
        userId: user.id,
        sentAt: { gte: today },
        status: "sent",
      },
    });

    return NextResponse.json({
      success: true,
      count,
      date: today.toISOString(),
    });
  } catch (error) {
    console.error("Daily count error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

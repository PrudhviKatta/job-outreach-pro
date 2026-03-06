// src/app/api/cleanup/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    if (
      process.env.NODE_ENV === "production" &&
      cronSecret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Delete old outreach history
    const deletedRecords = await prisma.outreachHistory.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });

    // Delete orphaned contacts (no outreach history)
    const contactsWithHistory = await prisma.outreachHistory.findMany({
      where: { contactId: { not: null } },
      select: { contactId: true },
      distinct: ["contactId"],
    });

    const activeContactIds = contactsWithHistory.map((r) => r.contactId);

    const deletedContacts = await prisma.contact.deleteMany({
      where: {
        updatedAt: { lt: ninetyDaysAgo },
        id: { notIn: activeContactIds },
      },
    });

    return NextResponse.json({
      success: true,
      deletedRecords: deletedRecords.count,
      deletedContacts: deletedContacts.count,
      cleanupDate: ninetyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }
  return POST(request);
}

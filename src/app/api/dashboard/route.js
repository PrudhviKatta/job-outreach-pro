// src/app/api/dashboard/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const { user, error } = await requireAuth();
        if (error) return error;

        // Today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Stats
        const [sentToday, opened, replied] = await Promise.all([
            prisma.outreachHistory.count({
                where: { userId: user.id, sentAt: { gte: today }, status: "sent" },
            }),
            prisma.outreachHistory.count({
                where: { userId: user.id, status: "opened" },
            }),
            prisma.outreachHistory.count({
                where: { userId: user.id, status: "replied" },
            }),
        ]);

        // Follow-ups: sent > 3 days ago, not opened/replied
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const followUps = await prisma.outreachHistory.findMany({
            where: {
                userId: user.id,
                status: "sent",
                sentAt: { lt: threeDaysAgo },
            },
            include: {
                contact: true,
            },
            orderBy: { sentAt: "desc" },
            take: 10,
        });

        return NextResponse.json({
            success: true,
            stats: { sentToday, opened, replied },
            followUps: followUps.map((item) => ({
                id: item.id,
                subject: item.subject,
                sentAt: item.sentAt,
                contact_id: item.contactId,
                contacts: item.contact
                    ? {
                        name: item.contact.name,
                        email: item.contact.email,
                        company: item.contact.company,
                    }
                    : null,
            })),
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

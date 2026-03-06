// src/app/api/settings/general/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export async function POST(request) {
    try {
        const { user, error } = await requireAuth();
        if (error) return error;

        const body = await request.json();

        await prisma.userSettings.upsert({
            where: { userId: user.id },
            update: {
                sendDelayMin: body.sendDelayMin || 8,
                sendDelayMax: body.sendDelayMax || 20,
                delayPreset: body.delayPreset || "moderate",
                businessHoursOnly: body.businessHoursOnly ?? true,
                followUpDays: body.followUpDays || 3,
                defaultResumeId: body.defaultResumeId || null,
            },
            create: {
                userId: user.id,
                sendDelayMin: body.sendDelayMin || 8,
                sendDelayMax: body.sendDelayMax || 20,
                delayPreset: body.delayPreset || "moderate",
                businessHoursOnly: body.businessHoursOnly ?? true,
                followUpDays: body.followUpDays || 3,
                defaultResumeId: body.defaultResumeId || null,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Settings saved successfully",
        });
    } catch (error) {
        console.error("Save general settings error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const { user, error } = await requireAuth();
        if (error) return error;

        const settings = await prisma.userSettings.findUnique({
            where: { userId: user.id },
            select: {
                sendDelayMin: true,
                sendDelayMax: true,
                delayPreset: true,
                businessHoursOnly: true,
                followUpDays: true,
                defaultResumeId: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: settings || {
                sendDelayMin: 8,
                sendDelayMax: 20,
                delayPreset: "moderate",
                businessHoursOnly: true,
                followUpDays: 3,
                defaultResumeId: null,
            },
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

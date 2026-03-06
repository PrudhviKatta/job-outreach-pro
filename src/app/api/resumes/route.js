// src/app/api/resumes/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

// List user's resumes
export async function GET() {
    try {
        const { user, error } = await requireAuth();
        if (error) return error;

        const resumes = await prisma.resume.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ success: true, data: resumes });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// Delete a resume
export async function DELETE(request) {
    try {
        const { user, error } = await requireAuth();
        if (error) return error;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Resume ID is required" },
                { status: 400 }
            );
        }

        const resume = await prisma.resume.findFirst({
            where: { id, userId: user.id },
        });

        if (!resume) {
            return NextResponse.json(
                { success: false, error: "Resume not found" },
                { status: 404 }
            );
        }

        // Delete file from disk
        try {
            const filePath = path.join(process.cwd(), "uploads", resume.fileUrl.replace(/^\/uploads\//, ""));
            await fs.unlink(filePath);
        } catch (err) {
            console.warn("Could not delete file:", err.message);
        }

        // Delete from DB
        await prisma.resume.delete({ where: { id } });

        return NextResponse.json({
            success: true,
            message: "Resume deleted",
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

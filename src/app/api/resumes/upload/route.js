// src/app/api/resumes/upload/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export async function POST(request) {
    try {
        const { user, error } = await requireAuth();
        if (error) return error;

        // Check resume count
        const currentCount = await prisma.resume.count({
            where: { userId: user.id },
        });

        if (currentCount >= 10) {
            return NextResponse.json(
                { success: false, error: "Maximum 10 resumes allowed" },
                { status: 400 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file");
        const displayName = formData.get("displayName") || file.name;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: "Only PDF and Word documents are allowed" },
                { status: 400 }
            );
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: "File size must be under 5MB" },
                { status: 400 }
            );
        }

        // Create upload directory
        const uploadDir = path.join(process.cwd(), "uploads", "resumes", user.id);
        await fs.mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.name);
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        const filePath = path.join(uploadDir, uniqueName);

        // Write file to disk
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        // URL path for serving via nginx
        const fileUrl = `/uploads/resumes/${user.id}/${uniqueName}`;

        // Save to database
        const resume = await prisma.resume.create({
            data: {
                userId: user.id,
                displayName: displayName,
                fileUrl,
                fileName: file.name,
                fileSize: file.size,
            },
        });

        return NextResponse.json({
            success: true,
            data: resume,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

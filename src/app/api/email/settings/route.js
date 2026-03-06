// src/app/api/email/settings/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";
import { encryptPassword, testSMTPConnection } from "@/lib/email";

export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { senderEmail, appPassword, testConnection } = await request.json();

    // Test SMTP connection if requested
    if (testConnection) {
      const testResult = await testSMTPConnection(senderEmail, appPassword);
      if (!testResult.success) {
        return NextResponse.json({
          success: false,
          error: `SMTP Test Failed: ${testResult.error}`,
        });
      }
    }

    // Encrypt the app password
    const encryptedPassword = encryptPassword(appPassword);

    // Upsert user settings
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        senderEmail,
        encryptedAppPassword: encryptedPassword,
        emailConfigured: true,
        emailVerified: testConnection || false,
        emailVerificationError: null,
        lastVerifiedAt: testConnection ? new Date() : null,
      },
      create: {
        userId: user.id,
        senderEmail,
        encryptedAppPassword: encryptedPassword,
        emailConfigured: true,
        emailVerified: testConnection || false,
        lastVerifiedAt: testConnection ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: testConnection
        ? "Email settings saved and verified successfully!"
        : "Email settings saved successfully!",
      verified: testConnection || false,
    });
  } catch (error) {
    console.error("Email settings error:", error);
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

    const data = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: {
        senderEmail: true,
        emailConfigured: true,
        emailVerified: true,
        emailVerificationError: true,
        lastVerifiedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: data || {
        senderEmail: null,
        emailConfigured: false,
        emailVerified: false,
        emailVerificationError: null,
        lastVerifiedAt: null,
      },
    });
  } catch (error) {
    console.error("Get email settings error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

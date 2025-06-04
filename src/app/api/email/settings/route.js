// src/app/api/email/settings/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  encryptPassword,
  decryptPassword,
  testSMTPConnection,
} from "@/lib/email";

export async function POST(request) {
  try {
    const { senderEmail, appPassword, testConnection } = await request.json();

    // Get the auth token from the request
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.replace("Bearer ", "");

    // If no auth header, try to get from cookies
    if (!token) {
      const cookies = request.headers.get("cookie");
      if (cookies) {
        const authCookie = cookies
          .split(";")
          .find((c) => c.trim().startsWith("sb-"))
          ?.split("=")[1];

        if (authCookie) {
          try {
            const parsed = JSON.parse(decodeURIComponent(authCookie));
            token = parsed.access_token;
          } catch (e) {
            console.log("Could not parse auth cookie");
          }
        }
      }
    }

    // Get user from token
    let user;
    if (token) {
      const { data: userData, error: userError } = await supabase.auth.getUser(
        token
      );
      if (!userError && userData?.user) {
        user = userData.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

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

    // Check if user settings exist first
    const { data: existingSettings } = await supabaseAdmin
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // Update user settings
    const updateData = {
      sender_email: senderEmail,
      encrypted_app_password: encryptedPassword,
      email_configured: true,
      email_verified: testConnection || false,
      email_verification_error: null,
      last_verified_at: testConnection ? new Date().toISOString() : null,
    };

    let data, error;

    if (existingSettings) {
      // Update existing record
      ({ data, error } = await supabaseAdmin
        .from("user_settings")
        .update(updateData)
        .eq("user_id", user.id)
        .select()
        .single());
    } else {
      // Insert new record
      ({ data, error } = await supabaseAdmin
        .from("user_settings")
        .insert({
          user_id: user.id,
          ...updateData,
        })
        .select()
        .single());
    }

    if (error) {
      console.error("Database update error:", error);
      throw new Error(`Failed to save email settings: ${error.message}`);
    }

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

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.replace("Bearer ", "");

    if (!token) {
      const cookies = request.headers.get("cookie");
      if (cookies) {
        const authCookie = cookies
          .split(";")
          .find((c) => c.trim().startsWith("sb-"))
          ?.split("=")[1];

        if (authCookie) {
          try {
            const parsed = JSON.parse(decodeURIComponent(authCookie));
            token = parsed.access_token;
          } catch (e) {
            console.log("Could not parse auth cookie");
          }
        }
      }
    }

    let user;
    if (token) {
      const { data: userData, error: userError } = await supabase.auth.getUser(
        token
      );
      if (!userError && userData?.user) {
        user = userData.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .select(
        "sender_email, email_configured, email_verified, email_verification_error, last_verified_at"
      )
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || {
        sender_email: null,
        email_configured: false,
        email_verified: false,
        email_verification_error: null,
        last_verified_at: null,
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

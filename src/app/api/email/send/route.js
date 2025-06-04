// src/app/api/email/send/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { sendBulkEmails, replaceVariables, decryptPassword } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function POST(request) {
  try {
    const { templateId, resumeId, recipients } = await request.json();
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

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

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

    // If we still don't have a user, try to get from session
    if (!user) {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user;
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log("User found:", user.id);

    // Get user's email settings
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select(
        "sender_email, encrypted_app_password, email_configured, email_verified"
      )
      .eq("user_id", user.id)
      .single();

    if (settingsError || !userSettings) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User settings not found. Please configure your email settings first.",
        },
        { status: 400 }
      );
    }

    if (
      !userSettings.email_configured ||
      !userSettings.sender_email ||
      !userSettings.encrypted_app_password
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Email not configured. Please configure your email settings in the Settings page.",
        },
        { status: 400 }
      );
    }

    // Decrypt the app password
    let appPassword;
    try {
      appPassword = decryptPassword(userSettings.encrypted_app_password);
    } catch (error) {
      console.error("Password decryption error:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            "Error decrypting email credentials. Please reconfigure your email settings.",
        },
        { status: 500 }
      );
    }

    // Fetch template using admin client
    const { data: template, error: templateError } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .single();

    if (templateError) {
      console.error("Template error:", templateError);
      throw new Error(`Template not found: ${templateError.message}`);
    }

    console.log("Template found:", template.name);

    // Fetch resume using admin client
    let resume = null;
    if (resumeId) {
      const { data: resumeData, error: resumeError } = await supabaseAdmin
        .from("resumes")
        .select("*")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();

      if (resumeError) {
        console.error("Resume error:", resumeError);
        throw new Error(`Resume not found: ${resumeError.message}`);
      }
      resume = resumeData;
    }

    console.log("Resume found:", resume?.display_name || "No resume selected");

    // Prepare emails
    const emails = recipients.map((recipient) => {
      const trackingId = generateTrackingId();

      const variables = {
        recruiterName: recipient.name,
        name: recipient.name,
        email: recipient.email,
        company: recipient.company || "",
        position: recipient.position || "",
        myName: user.user_metadata?.name || user.email,
        myEmail: user.email,
      };

      const subject = replaceVariables(template.subject, variables);
      const body = replaceVariables(template.body, variables);

      return {
        to: recipient.email,
        subject,
        body,
        attachments: resume
          ? [
              {
                filename: resume.file_name,
                path: resume.file_url,
              },
            ]
          : [],
        trackingId,
        senderEmail: userSettings.sender_email,
        appPassword,
        metadata: {
          recipientName: recipient.name,
          templateId,
          resumeId,
        },
      };
    });

    console.log("Sending emails to:", emails.length, "recipients");

    // Send emails with delay
    const results = await sendBulkEmails(emails);

    console.log("Email results:", results);

    // Save to database using admin client
    const outreachRecords = [];
    for (let i = 0; i < recipients.length; i++) {
      if (results[i].success) {
        // Save contact if doesn't exist
        const { data: contact } = await supabaseAdmin
          .from("contacts")
          .upsert(
            {
              user_id: user.id,
              name: recipients[i].name,
              email: recipients[i].email,
              company: recipients[i].company,
              position: recipients[i].position,
            },
            {
              onConflict: "user_id,email",
            }
          )
          .select()
          .single();

        // Save outreach history
        outreachRecords.push({
          user_id: user.id,
          contact_id: contact?.id,
          template_id: templateId,
          resume_id: resumeId || null,
          type: "email",
          subject: emails[i].subject,
          content: emails[i].body,
          status: "sent",
          tracking_id: emails[i].trackingId,
          metadata: emails[i].metadata,
        });
      }
    }

    if (outreachRecords.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("outreach_history")
        .insert(outreachRecords);

      if (insertError) {
        console.error("Error saving outreach history:", insertError);
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

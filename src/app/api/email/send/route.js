import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendBulkEmails, replaceVariables } from "@/lib/email";
import { generateTrackingId } from "@/lib/utils";

export async function POST(request) {
  try {
    const { templateId, resumeId, recipients } = await request.json();

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError) throw templateError;

    // Fetch resume
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (resumeError) throw resumeError;

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

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
        attachments: [
          {
            filename: resume.file_name,
            path: resume.file_url,
          },
        ],
        trackingId,
        metadata: {
          recipientName: recipient.name,
          templateId,
          resumeId,
        },
      };
    });

    // Send emails with delay
    const results = await sendBulkEmails(emails);

    // Save to database
    const outreachRecords = [];
    for (let i = 0; i < recipients.length; i++) {
      if (results[i].success) {
        // Save contact if doesn't exist
        const { data: contact } = await supabase
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
          resume_id: resumeId,
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
      await supabase.from("outreach_history").insert(outreachRecords);
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

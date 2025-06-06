// src/app/api/campaigns/draft/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  try {
    console.log("=== DRAFT API CALLED ===");
    const { templateId, resumeId, recipients, campaignName } =
      await request.json();
    console.log("Request data:", {
      templateId,
      resumeId,
      recipients: recipients?.length,
      campaignName,
    });
    // Get user authentication
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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

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

    console.log("User found:", user.id);

    // Check if user has an active draft campaign
    const { data: existingDraft } = await supabaseAdmin
      .from("email_campaigns")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .single();

    let campaignId;

    if (existingDraft) {
      console.log("Updating existing draft:", existingDraft.id);

      // Update existing draft
      campaignId = existingDraft.id;

      // Update campaign details
      await supabaseAdmin
        .from("email_campaigns")
        .update({
          name: campaignName || null,
          template_id: templateId,
          resume_id: resumeId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      // Clear existing recipients
      await supabaseAdmin
        .from("campaign_recipients")
        .delete()
        .eq("campaign_id", campaignId);
    } else {
      console.log("Creating new campaign");

      // Create new campaign
      const { data: newCampaign, error: campaignError } = await supabaseAdmin
        .from("email_campaigns")
        .insert({
          user_id: user.id,
          name: campaignName || null,
          template_id: templateId,
          resume_id: resumeId || null,
          status: "draft",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;
      campaignId = newCampaign.id;
    }

    // Add recipients
    if (recipients && recipients.length > 0) {
      const recipientData = recipients.map((recipient) => ({
        campaign_id: campaignId,
        name: recipient.name,
        email: recipient.email,
        company: recipient.company || null,
        position: recipient.position || null,
      }));

      const { error: recipientsError } = await supabaseAdmin
        .from("campaign_recipients")
        .insert(recipientData);

      if (recipientsError) throw recipientsError;
    }

    return NextResponse.json({
      success: true,
      campaignId,
      message: "Draft saved successfully",
    });
  } catch (error) {
    console.error("Save draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET: Load the current draft
export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.replace("Bearer ", "");

    // Get user authentication (same as above)
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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

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

    // Get current draft campaign
    const { data: draft, error: draftError } = await supabaseAdmin
      .from("email_campaigns")
      .select(
        `
      id,
      name,
      template_id,
      resume_id,
      status,
      created_at,
      campaign_recipients!inner (
        id,
        name,
        email,
        company,
        position,
        status
      )
    `
      )
      .eq("user_id", user.id)
      .eq("status", "draft")
      .eq("campaign_recipients.status", "pending")
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      ) // Only drafts from last 24 hours
      .single();

    if (draftError || !draft) {
      return NextResponse.json({
        success: true,
        draft: null,
      });
    }

    return NextResponse.json({
      success: true,
      draft: {
        campaignId: draft.id,
        campaignName: draft.name,
        templateId: draft.template_id,
        resumeId: draft.resume_id,
        recipients: draft.campaign_recipients || [],
      },
    });
  } catch (error) {
    console.error("Load draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

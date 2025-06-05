// src/app/api/campaigns/status/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

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

    // Get campaign details with recipients
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("email_campaigns")
      .select(
        `
        id,
        name,
        status,
        total_recipients,
        sent_count,
        failed_count,
        created_at,
        started_at,
        completed_at,
        campaign_recipients (
          id,
          name,
          email,
          company,
          position,
          status,
          error_message,
          sent_at
        )
      `
      )
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Organize recipients by status
    const recipients = campaign.campaign_recipients || [];
    const pendingRecipients = recipients.filter((r) => r.status === "pending");
    const sendingRecipients = recipients.filter((r) => r.status === "sending");
    const sentRecipients = recipients.filter((r) => r.status === "sent");
    const failedRecipients = recipients.filter((r) => r.status === "failed");

    // Find currently sending recipient
    const currentlySending =
      sendingRecipients.length > 0 ? sendingRecipients[0] : null;

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        progress: {
          total: campaign.total_recipients,
          sent: campaign.sent_count,
          failed: campaign.failed_count,
          pending: pendingRecipients.length,
        },
        recipients: {
          pending: pendingRecipients,
          sent: sentRecipients.map((r) => ({
            ...r,
            sentAt: r.sent_at,
          })),
          failed: failedRecipients,
        },
        currentlySending,
        timestamps: {
          created: campaign.created_at,
          started: campaign.started_at,
          completed: campaign.completed_at,
        },
      },
    });
  } catch (error) {
    console.error("Get campaign status error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Update campaign status (pause/resume/cancel)
export async function POST(request) {
  try {
    const { campaignId, action } = await request.json();

    if (!campaignId || !action) {
      return NextResponse.json(
        { success: false, error: "Campaign ID and action are required" },
        { status: 400 }
      );
    }

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

    let newStatus;
    let updateData = { updated_at: new Date().toISOString() };

    switch (action) {
      case "pause":
        newStatus = "paused";
        updateData.status = newStatus;
        break;
      case "resume":
        newStatus = "sending";
        updateData.status = newStatus;
        break;
      case "cancel":
        newStatus = "cancelled";
        updateData.status = newStatus;
        updateData.completed_at = new Date().toISOString();
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update campaign status
    const { error: updateError } = await supabaseAdmin
      .from("email_campaigns")
      .update(updateData)
      .eq("id", campaignId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: `Campaign ${action}d successfully`,
      newStatus,
    });
  } catch (error) {
    console.error("Update campaign status error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

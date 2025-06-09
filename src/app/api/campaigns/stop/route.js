// src/app/api/campaigns/stop/route.js - FIXED VERSION
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  try {
    const { campaignId } = await request.json();

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

    console.log("🛑 Attempting to stop campaign:", campaignId);

    // Update campaign status to stopped
    const { data: campaign, error: updateError } = await supabaseAdmin
      .from("email_campaigns")
      .update({
        status: "stopped",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .select()
      .single();

    console.log("📋 Update result:", { campaign, updateError });

    if (updateError) {
      console.error("❌ Stop campaign database error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    if (!campaign) {
      console.log("❌ No campaign returned - user mismatch or not found");
      return NextResponse.json(
        { success: false, error: "Campaign not found or access denied" },
        { status: 404 }
      );
    }

    console.log("✅ Campaign stopped in database:", campaign);

    return NextResponse.json({
      success: true,
      message: "Campaign stopped successfully",
      campaign: campaign,
    });
  } catch (error) {
    console.error("❌ Stop campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

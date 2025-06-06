// src/app/api/campaigns/daily-count/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  try {
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

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    // First get user's campaign IDs
    const { data: userCampaigns, error: campaignsError } = await supabaseAdmin
      .from("email_campaigns")
      .select("id")
      .eq("user_id", user.id);

    if (campaignsError) {
      console.error("Error getting user campaigns:", campaignsError);
      return NextResponse.json({ success: true, count: 0 });
    }

    const campaignIds = userCampaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Count emails sent today across user's campaigns
    const { data, error, count } = await supabaseAdmin
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("updated_at", todayStart)
      .lte("updated_at", todayEnd)
      .in("campaign_id", campaignIds);
    if (error) {
      console.error("Error counting daily emails:", error);
      return NextResponse.json(
        { success: false, error: "Failed to get daily count" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
      date: today,
      remaining: Math.max(0, 500 - (count || 0)),
    });
  } catch (error) {
    console.error("Daily count API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

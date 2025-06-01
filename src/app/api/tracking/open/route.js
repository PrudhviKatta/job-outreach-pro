import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get("id");

    if (trackingId) {
      // Update the outreach record
      await supabase
        .from("outreach_history")
        .update({
          status: "opened",
          opened_at: new Date().toISOString(),
        })
        .eq("tracking_id", trackingId);
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );

    return new NextResponse(pixel, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Tracking error:", error);
    return new NextResponse(null, { status: 200 });
  }
}

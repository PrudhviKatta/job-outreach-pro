// src/app/api/cleanup/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    // Verify this is called from a cron job or authorized source
    const authHeader = request.headers.get("authorization");
    const cronSecret = request.headers.get("x-cron-secret");

    // Check if it's a cron job (Vercel cron) or manual trigger
    if (cronSecret !== process.env.CRON_SECRET && !authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Delete outreach_history older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: deletedRecords, error: deleteError } = await supabaseAdmin
      .from("outreach_history")
      .delete()
      .lt("created_at", ninetyDaysAgo.toISOString());

    if (deleteError) {
      console.error("Cleanup error:", deleteError);
      throw deleteError;
    }

    // Also cleanup very old contacts that haven't been contacted recently
    const { data: deletedContacts, error: contactError } = await supabaseAdmin
      .from("contacts")
      .delete()
      .lt("updated_at", ninetyDaysAgo.toISOString())
      .not(
        "id",
        "in",
        `(SELECT DISTINCT contact_id FROM outreach_history WHERE contact_id IS NOT NULL)`
      );

    if (contactError) {
      console.error("Contact cleanup error:", contactError);
      // Don't throw - this is optional cleanup
    }

    return NextResponse.json({
      success: true,
      deletedRecords: deletedRecords?.length || 0,
      deletedContacts: deletedContacts?.length || 0,
      cleanupDate: ninetyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Manual cleanup endpoint (for testing)
export async function GET(request) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  return POST(request);
}

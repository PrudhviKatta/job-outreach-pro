// src/app/api/templates/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as clientSupabase } from "@/lib/supabase";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify the token and get user
    const {
      data: { user },
      error: authError,
    } = await clientSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "email";
    const includeArchived = searchParams.get("includeArchived") === "true";

    // Create an admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let query = supabaseAdmin
      .from("templates")
      .select("*")
      .eq("type", type)
      .eq("user_id", user.id);

    // Filter out deleted templates unless specifically requested
    if (!includeArchived) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await clientSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.body || !body.type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, body, type" },
        { status: 400 }
      );
    }

    // Validate email template has subject
    if (body.type === "email" && !body.subject) {
      return NextResponse.json(
        { success: false, error: "Email templates require a subject" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from("templates")
      .insert({
        ...body,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await clientSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from("templates")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id) // Ensure user can only update their own templates
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Template not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await clientSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hardDelete") === "true";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    if (hardDelete) {
      // Hard delete - only allowed if no outreach history exists
      const { data: outreachExists } = await supabaseAdmin
        .from("outreach_history")
        .select("id")
        .eq("template_id", id)
        .limit(1);

      if (outreachExists && outreachExists.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot permanently delete template with existing outreach history. Use archive instead.",
          },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from("templates")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Template permanently deleted",
      });
    } else {
      // Soft delete (archive)
      const { data, error } = await supabaseAdmin
        .from("templates")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return NextResponse.json(
          { success: false, error: "Template not found or access denied" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Template archived successfully",
        data,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH method for restoring archived templates
export async function PATCH(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await clientSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id, action } = await request.json();

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "Template ID and action are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    if (action === "restore") {
      const { data, error } = await supabaseAdmin
        .from("templates")
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return NextResponse.json(
          { success: false, error: "Template not found or access denied" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Template restored successfully",
        data,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

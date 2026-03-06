// src/app/api/templates/route.js
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "email";
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where = {
      userId: user.id,
      type,
      ...(includeArchived ? {} : { deletedAt: null }),
    };

    const data = await prisma.template.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

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
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();

    if (!body.name || !body.body || !body.type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, body, type" },
        { status: 400 }
      );
    }

    if (body.type === "email" && !body.subject) {
      return NextResponse.json(
        { success: false, error: "Email templates require a subject" },
        { status: 400 }
      );
    }

    const data = await prisma.template.create({
      data: {
        userId: user.id,
        name: body.name,
        subject: body.subject || null,
        body: body.body,
        type: body.type,
        category: body.category || null,
      },
    });

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
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const data = await prisma.template.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.subject !== undefined && { subject: updateData.subject }),
        ...(updateData.body !== undefined && { body: updateData.body }),
        ...(updateData.category !== undefined && { category: updateData.category }),
      },
    });

    if (data.count === 0) {
      return NextResponse.json(
        { success: false, error: "Template not found or access denied" },
        { status: 404 }
      );
    }

    const updated = await prisma.template.findUnique({ where: { id } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hardDelete") === "true";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    if (hardDelete) {
      const outreachExists = await prisma.outreachHistory.findFirst({
        where: { templateId: id },
        select: { id: true },
      });

      if (outreachExists) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot permanently delete template with existing outreach history. Use archive instead.",
          },
          { status: 400 }
        );
      }

      await prisma.template.deleteMany({
        where: { id, userId: user.id },
      });

      return NextResponse.json({
        success: true,
        message: "Template permanently deleted",
      });
    } else {
      // Soft delete (archive)
      const result = await prisma.template.updateMany({
        where: { id, userId: user.id },
        data: { deletedAt: new Date() },
      });

      if (result.count === 0) {
        return NextResponse.json(
          { success: false, error: "Template not found or access denied" },
          { status: 404 }
        );
      }

      const data = await prisma.template.findUnique({ where: { id } });
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
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id, action } = await request.json();

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "Template ID and action are required" },
        { status: 400 }
      );
    }

    if (action === "restore") {
      const result = await prisma.template.updateMany({
        where: { id, userId: user.id },
        data: { deletedAt: null },
      });

      if (result.count === 0) {
        return NextResponse.json(
          { success: false, error: "Template not found or access denied" },
          { status: 404 }
        );
      }

      const data = await prisma.template.findUnique({ where: { id } });
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

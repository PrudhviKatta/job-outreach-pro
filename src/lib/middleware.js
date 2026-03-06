import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Shared auth middleware for API routes.
 * Returns the authenticated user or an error response.
 *
 * Usage:
 *   const { user, error } = await requireAuth();
 *   if (error) return error;
 *   // user.id, user.email, user.name are available
 */
export async function requireAuth() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return {
                user: null,
                error: NextResponse.json(
                    { success: false, error: "Not authenticated" },
                    { status: 401 }
                ),
            };
        }

        return {
            user: session.user,
            error: null,
        };
    } catch (err) {
        console.error("Auth middleware error:", err);
        return {
            user: null,
            error: NextResponse.json(
                { success: false, error: "Authentication error" },
                { status: 500 }
            ),
        };
    }
}

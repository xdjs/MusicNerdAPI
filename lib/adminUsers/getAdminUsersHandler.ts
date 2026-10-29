import { NextResponse } from "next/server";
import { searchUsers } from "@/lib/adminUsers/searchUsers";
import { validateUserSearchQuery } from "@/lib/adminUsers/validateUserSearchQuery";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/users: users whose wallet or username matches `search`.
 *
 * @param request - The request; an admin's Privy token and `?search=`.
 * @returns 200 with `{ status, users }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getAdminUsersHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const query = validateUserSearchQuery(request);
    if (query instanceof NextResponse) return query;
    const users = await searchUsers(query.search);
    return NextResponse.json({ status: "ok", users }, { status: 200, headers });
  } catch (e) {
    console.error("[admin/users] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

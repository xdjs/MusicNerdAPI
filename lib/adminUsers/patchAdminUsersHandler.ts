import { NextResponse } from "next/server";
import { setUserRole } from "@/lib/adminUsers/setUserRole";
import { validateUserRoleBody } from "@/lib/adminUsers/validateUserRoleBody";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles PATCH /api/admin/users: turns one role on or off for the given users.
 *
 * @param request - The request; an admin's Privy token and `{ userIds, role, enabled }`.
 * @returns 200 with `{ status, updated }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function patchAdminUsersHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const body = await validateUserRoleBody(request);
    if (body instanceof NextResponse) return body;
    const updated = await setUserRole(body.userIds, body.role, body.enabled);
    return NextResponse.json({ status: "ok", updated }, { status: 200, headers });
  } catch (e) {
    console.error("[admin/users] PATCH error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

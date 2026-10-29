import { NextResponse } from "next/server";
import { getAdminContributions } from "@/lib/adminContributions/getAdminContributions";
import { validateAdminContributionsQuery } from "@/lib/adminContributions/validateAdminContributionsQuery";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserById } from "@/lib/users/getUserById";

/**
 * Handles GET /api/admin/contributions: one page of contributions, with the
 * contributor's account when `userId` is given. Admin only.
 *
 * @param request - The request; an admin's Privy token and optional filters.
 * @returns 200 with `{ status, items, counts, total, page, pageSize, filters, account }`; 400, 401, 403, 404 or 500.
 */
export async function getAdminContributionsHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const filters = validateAdminContributionsQuery(request);
    if (filters instanceof NextResponse) return filters;
    const [list, user] = await Promise.all([
      getAdminContributions(filters),
      filters.userId ? getUserById(filters.userId) : undefined,
    ]);
    if (filters.userId && !user)
      return NextResponse.json(
        { status: "error", error: "User not found" },
        { status: 404, headers },
      );
    const account = user ? { id: user.id, username: user.username, email: user.email } : null;
    return NextResponse.json({ status: "ok", ...list, account }, { headers });
  } catch (e) {
    console.error("[admin/contributions] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

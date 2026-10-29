import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { listAdminClaims } from "@/lib/claims/listAdminClaims";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/claims: up to 200 artist claims, pending first. Admin only.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with `{ status, claims }`; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getAdminClaimsHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const claims = await listAdminClaims();
    return NextResponse.json({ status: "ok", claims }, { headers });
  } catch (e) {
    console.error("[admin/claims] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { getArtistActivity } from "@/lib/adminActivity/getArtistActivity";
import { validateArtistActivityQuery } from "@/lib/adminActivity/validateArtistActivityQuery";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/activity: one page of the artist activity log. Admin only.
 *
 * @param request - The request; an admin's Privy token and optional `query`, `action`, `eventId`, `page`.
 * @returns 200 with `{ status, items, total, page, pageSize, filters }`; 401, 403 or 500.
 */
export async function getArtistActivityHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const log = await getArtistActivity(validateArtistActivityQuery(request));
    return NextResponse.json({ status: "ok", ...log }, { headers });
  } catch (e) {
    console.error("[admin/activity] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

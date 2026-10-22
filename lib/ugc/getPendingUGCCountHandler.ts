import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { countPendingUGC } from "@/lib/ugc/countPendingUGC";

/**
 * Handles GET /api/pendingUGCCount. MusicNerdWeb's site calls it for every
 * signed-in user to decide whether to show the admin badge, so anyone who is
 * not an admin gets `count: 0` rather than a 401 or 403, and so does a
 * database failure (MusicNerdWeb's behaviour, kept).
 *
 * @param request - The request; a Privy token, or none.
 * @returns 200 with `{ status: "ok", count }`.
 */
export async function getPendingUGCCountHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    const count = auth instanceof NextResponse ? 0 : await countPendingUGC();
    return NextResponse.json({ status: "ok", count }, { status: 200, headers });
  } catch (error) {
    console.error("[pendingUGCCount] Error:", error);
    return NextResponse.json({ status: "ok", count: 0 }, { status: 200, headers });
  }
}

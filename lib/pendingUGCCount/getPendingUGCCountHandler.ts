import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/pendingUGCCount: how many link submissions await review
 * (not accepted and not yet processed). Admin only.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ status, count }`, 401/403, or 500.
 */
export async function getPendingUGCCountHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  try {
    const [row] = await db.execute<{ count: number }>(sql`select count(*)::int as count
      from ugcresearch where accepted = false and date_processed is null`);
    return NextResponse.json({ status: "ok", count: row?.count ?? 0 }, { headers });
  } catch (e) {
    console.error("[pendingUGCCount] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/approvedUGCCount — approved UGC entries for the user.
 *
 * @param request - Authenticated request.
 * @returns 200 with `{ status: "ok", count }`.
 */
export async function getApprovedUGCCountHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const [{ total }] = await db
    .select({ total: count() })
    .from(ugcresearch)
    .where(and(eq(ugcresearch.userId, auth.userId), eq(ugcresearch.accepted, true)));

  return NextResponse.json(
    { status: "ok", count: total },
    { status: 200, headers: getCorsHeaders() },
  );
}

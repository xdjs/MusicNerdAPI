import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUgcCountHandler } from "@/lib/ugcCount/getUgcCountHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers and no body.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/ugcCount — total UGC entries for the user.
 *
 * @param request - Authenticated request.
 * @returns 200 with `{ status: "ok", count }`.
 */
export async function GET(request: Request) {
  return getUgcCountHandler(request);
}

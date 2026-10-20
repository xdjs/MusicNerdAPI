import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getActivityHandler } from "@/lib/activity/getActivityHandler";

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
 * GET /api/activity — recent platform activity.
 *
 * @param request - Optional `?since=` ISO date filter.
 * @returns 200 with an array of activity events.
 */
export async function GET(request: Request) {
  return getActivityHandler(request);
}

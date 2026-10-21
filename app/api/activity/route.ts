import { NextResponse } from "next/server";
import { getActivityHandler } from "@/lib/activityFeed/getActivityHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The public activity feed: the 15 most recent events across the site, newest first.
 *
 * @param request - The request; `since` optional.
 * @returns 200 with `{ status, events }`, 400 for a bad `since`, or 500.
 */
export async function GET(request: Request) {
  return getActivityHandler(request);
}

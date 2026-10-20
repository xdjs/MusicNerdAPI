import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getRecentEditedHandler } from "@/lib/recentEdited/getRecentEditedHandler";

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
 * GET /api/recentEdited — recently edited artists for the user.
 *
 * @param request - Authenticated request.
 * @returns 200 with an array of recently edited artist entries.
 */
export async function GET(request: Request) {
  return getRecentEditedHandler(request);
}

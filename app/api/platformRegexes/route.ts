import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPlatformRegexesHandler } from "@/lib/platformRegexes/getPlatformRegexesHandler";

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
 * GET /api/platformRegexes — URL patterns for each platform.
 *
 * @returns 200 with `[{ siteName, regex }]`.
 */
export async function GET() {
  return getPlatformRegexesHandler();
}

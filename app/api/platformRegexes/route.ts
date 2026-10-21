import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPlatformRegexesHandler } from "@/lib/platformRegexes/getPlatformRegexesHandler";

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
 * Every urlmap platform's URL pattern except ens and wallets. Public.
 *
 * @returns 200 with `{ status, regexes }`, or 500.
 */
export async function GET() {
  return getPlatformRegexesHandler();
}

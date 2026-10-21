import { NextResponse } from "next/server";
import { getUserEntriesHandler } from "@/lib/contributions/getUserEntriesHandler";
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
 * The signed-in user's submitted links with their artists, ten per page, filterable.
 *
 * @param request - The request; a Privy token, filters optional.
 * @returns 200 with `{ status, entries, total, pageCount, platforms }`, or 500.
 */
export async function GET(request: Request) {
  return getUserEntriesHandler(request);
}

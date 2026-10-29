import { NextResponse } from "next/server";
import { getArtistActivityHandler } from "@/lib/adminActivity/getArtistActivityHandler";
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
 * One page of the artist activity log, newest first.
 *
 * @param request - The request; an admin's Privy token and optional `query`, `action`, `eventId`, `page`.
 * @returns 200 with the page, or an error.
 */
export async function GET(request: Request) {
  return getArtistActivityHandler(request);
}

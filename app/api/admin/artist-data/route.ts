import { NextResponse } from "next/server";
import { getArtistDataHandler } from "@/lib/artistData/getArtistDataHandler";
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
 * The Artist data tab: link and platform-ID coverage, completeness and
 * enrichment readiness, cached for 30 seconds.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with the summary, or an error.
 */
export async function GET(request: Request) {
  return getArtistDataHandler(request);
}

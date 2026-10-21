import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileArtistSummariesHandler } from "@/lib/profile/getProfileArtistSummariesHandler";

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
 * The About of up to six artists.
 *
 * @param request - The request: a Privy token and repeated `id` parameters.
 * @returns The handler's response.
 */
export async function GET(request: Request) {
  return getProfileArtistSummariesHandler(request);
}

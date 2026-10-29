import { NextResponse } from "next/server";
import { postAddArtistHandler } from "@/lib/addArtist/postAddArtistHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";
/** The directory research wake runs after the response, within this allowance. */
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Adds an artist to the directory from a Spotify or Deezer id.
 *
 * @param request - The request; any signed-in user's Privy token and `{ platformId, platform?, forceCreate? }`.
 * @returns 200 with `{ status, result, message, ... }`, or an error.
 */
export async function POST(request: Request) {
  return postAddArtistHandler(request);
}

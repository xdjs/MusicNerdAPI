import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postAskArtistHandler } from "@/lib/askArtist/postAskArtistHandler";

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
 * POST /api/askArtist — ask a question about an artist.
 *
 * @param request - Authenticated POST with `{ artistId, question }`.
 * @returns 501 until the orchestration is migrated from MusicNerdWeb.
 */
export async function POST(request: Request) {
  return postAskArtistHandler(request);
}

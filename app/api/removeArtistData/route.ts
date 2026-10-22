import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postRemoveArtistDataHandler } from "@/lib/removeArtistData/postRemoveArtistDataHandler";

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
 * Empties one platform column on an artist, for a whitelisted user or an admin.
 *
 * @param request - The request; a Privy token and `{ artistId, siteName }`.
 * @returns 200 with `{ status, success, message }`, or an error.
 */
export async function POST(request: Request) {
  return postRemoveArtistDataHandler(request);
}

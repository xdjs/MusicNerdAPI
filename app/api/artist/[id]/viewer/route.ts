import { NextResponse } from "next/server";
import { getArtistViewerHandler } from "@/lib/artistViewer/getArtistViewerHandler";
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
 * The caller's own active claim status on the artist, and whether they added it.
 *
 * @param request - The request; a signed-in user's Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, claimStatus, addedByCaller }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistViewerHandler(request, id);
}

import { NextResponse } from "next/server";
import { postArtistLinkHandler } from "@/lib/artistLinkSubmission/postArtistLinkHandler";
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
 * Suggests a platform link for the artist.
 *
 * @param request - The request; any signed-in user's Privy token and `{ url }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, approved, siteName, platformName, message }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postArtistLinkHandler(request, id);
}

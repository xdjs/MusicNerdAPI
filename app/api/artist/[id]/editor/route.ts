import { NextResponse } from "next/server";
import { getArtistEditorHandler } from "@/lib/artistEditor/getArtistEditorHandler";
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
 * The editor view: the About as stored and every approved and pending source with contributor names.
 *
 * @param request - The request; the claimant's or an admin's Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, bio, approvedSources, pendingSources }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistEditorHandler(request, id);
}

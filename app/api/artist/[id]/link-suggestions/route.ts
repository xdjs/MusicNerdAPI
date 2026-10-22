import { NextResponse } from "next/server";
import { getArtistLinkSuggestionsHandler } from "@/lib/artistLinkReview/getArtistLinkSuggestionsHandler";
import { postArtistLinkSuggestionHandler } from "@/lib/artistLinkReview/postArtistLinkSuggestionHandler";
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
 * One page of the artist's link suggestions, for its claimant or an admin.
 *
 * @param request - The request; a Privy token, optional `?offset=`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, items, hasMore, nextOffset }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistLinkSuggestionsHandler(request, id);
}

/**
 * Approves, dismisses, removes or restores one suggestion.
 *
 * @param request - The request; a claimant or admin Privy token and `{ id, kind, decision }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, success }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postArtistLinkSuggestionHandler(request, id);
}

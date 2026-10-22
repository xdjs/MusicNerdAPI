import { NextResponse } from "next/server";
import { getArtistLinkSuggestions } from "@/lib/artistLinkReview/getArtistLinkSuggestions";
import { validateLinkSuggestionsQuery } from "@/lib/artistLinkReview/validateLinkSuggestionsQuery";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles GET /api/artist/{id}/link-suggestions: one page of the artist's link
 * suggestions, for its claimant or an admin. Never cached.
 *
 * @param request - The request; a Privy token, optional `?offset=`.
 * @param id - The artist id from the path.
 * @returns 200 `{ status, items, hasMore, nextOffset }`; 400, 401, 403 or 500.
 */
export async function getArtistLinkSuggestionsHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const query = validateLinkSuggestionsQuery(request, id);
    if (query instanceof NextResponse) return query;
    const page = await getArtistLinkSuggestions(query.artistId, auth.userId, query.offset);
    return NextResponse.json({ status: "ok", ...page }, { status: 200, headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error("Not authorized for this artist", 403);
    console.error("[artist/link-suggestions] Load failed", e);
    return error("Could not load link suggestions", 500);
  }
}

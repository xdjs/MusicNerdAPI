import { NextResponse } from "next/server";
import { reviewArtistLinkSuggestion } from "@/lib/artistLinkReview/reviewArtistLinkSuggestion";
import { validateLinkReviewBody } from "@/lib/artistLinkReview/validateLinkReviewBody";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles POST /api/artist/{id}/link-suggestions: the claimant or an admin
 * approves, dismisses, removes or restores one suggestion.
 *
 * @param request - The request; a Privy token and `{ id, kind, decision }`.
 * @param id - The artist id from the path.
 * @returns 200 `{ status, success }`; 400, 401, 403, 409 or 500 `{ status, error }`.
 */
export async function postArtistLinkSuggestionHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = validateLinkReviewBody(await request.json().catch(() => null), id);
    if (body instanceof NextResponse) return body;
    await reviewArtistLinkSuggestion(body.artistId, auth.userId, body.input);
    return NextResponse.json({ status: "ok", success: true }, { status: 200, headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error("Not authorized for this artist", 403);
    if (e instanceof ArtistLinkConflictError) return error(e.message, 409);
    console.error("[artist/link-suggestions] Review failed", e);
    return error("Could not review this link", 500);
  }
}

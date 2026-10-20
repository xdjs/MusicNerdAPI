import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { resetClaimBuild } from "@/lib/claimBuild/resetClaimBuild";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/onboarding/{artistId}/reset: removes everything the claim
 * build wrote and returns the removed values as the backup.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param artistId - The artist id from the path.
 * @returns 200 with `{ status, removed }`; 400, 401, 403 or 404.
 */
export async function postResetClaimBuildHandler(request: Request, artistId: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const auth = await validateArtistEditRequest(request, artistId);
  if (auth instanceof NextResponse) return auth;
  const removed = await resetClaimBuild(auth.artistId);
  if (!removed)
    return NextResponse.json(
      { status: "error", error: "Artist not found" },
      { status: 404, headers },
    );
  return NextResponse.json({ status: "ok", removed }, { status: 200, headers });
}

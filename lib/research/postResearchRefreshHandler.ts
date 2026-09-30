import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { requestResearchRefresh } from "@/lib/research/requestResearchRefresh";

/**
 * `POST /api/artist/{id}/research/refresh`: the claimant (or an admin) asks
 * for "look again". Signed in with a Privy access token.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param id - The artist id from the path.
 * @returns `{ status: "ok", message }`, or 400 / 401 / 403 / 500 with `{ status: "error", error }`.
 */
export async function postResearchRefreshHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const validated = await validateArtistEditRequest(request, id);
    if (validated instanceof NextResponse) return validated;
    const { artistId, userId } = validated;
    const claimId = (await findApprovedClaim(db, artistId))?.id ?? null;
    const message = await withArtistOperation(
      artistId,
      { userId, expectedClaimId: claimId, trigger: "manual_refresh" },
      () => requestResearchRefresh(artistId, claimId),
    );
    return NextResponse.json({ status: "ok", message }, { headers });
  } catch (e) {
    console.error("[research/refresh] Error:", e);
    return NextResponse.json(
      { status: "error", error: "Couldn't start that" },
      { status: 500, headers },
    );
  }
}

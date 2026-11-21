import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { unpinArtistBio } from "@/lib/bio/unpinArtistBio";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles DELETE /api/artistBio/{id}/pin: the claimant or an admin unpins the
 * bio so the About can be edited or regenerated again. The text is unchanged.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403 or 500 with `{ status, error }`.
 */
export async function deleteArtistBioPinHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    if (!z.uuid().safeParse(id).success) return error("artistId must be a UUID", 400);
    const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    await unpinArtistBio(auth.artistId, { userId: auth.userId, expectedClaimId });
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    console.error("[artistBio/pin] Unpin failed", e);
    return error("Could not unpin bio", 500);
  }
}

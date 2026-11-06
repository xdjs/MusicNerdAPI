import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { deleteBioVersion } from "@/lib/bio/deleteBioVersion";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles DELETE /api/artistBio/{id}/versions/{versionId}: the claimant or an
 * admin deletes one saved bio. The pinned bio can't be deleted.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @param versionId - The saved bio's id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403, 404, 409 or 500 with `{ status, error }`.
 */
export async function deleteArtistBioVersionHandler(
  request: Request,
  id: string,
  versionId: string,
) {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    if (!z.uuid().safeParse(id).success) return error("artistId must be a UUID", 400);
    if (!z.uuid().safeParse(versionId).success) return error("versionId must be a UUID", 400);
    const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const result = await deleteBioVersion(versionId, auth.artistId, {
      userId: auth.userId,
      expectedClaimId,
    });
    if (result === "not_found") return error("Bio version not found", 404);
    if (result === "pinned") return error("Cannot delete a pinned bio version", 409);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    console.error("[artistBio/versions] Delete failed", e);
    return error("Failed to delete bio version", 500);
  }
}

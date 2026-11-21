import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { pinBioVersion } from "@/lib/bio/pinBioVersion";
import { validateArtistBioPinBody } from "@/lib/bio/validateArtistBioPinBody";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles PUT /api/artistBio/{id}/pin: the claimant or an admin pins a saved
 * bio, which becomes the About and stays locked until unpinned. The write is
 * fenced on the claim read before authorization.
 *
 * @param request - The request; a claimant or admin Privy token and `{ versionId }`.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403, 404 or 500 with `{ status, error }`.
 */
export async function putArtistBioPinHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    if (!z.uuid().safeParse(id).success) return error("artistId must be a UUID", 400);
    const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const body = validateArtistBioPinBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const pinned = await pinBioVersion(body.versionId, auth.artistId, {
      userId: auth.userId,
      expectedClaimId,
    });
    if (!pinned) return error("Bio version not found", 404);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    console.error("[artistBio/pin] Pin failed", e);
    return error("Failed to pin bio version", 500);
  }
}

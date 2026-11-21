import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { deleteDocCorrection } from "@/lib/knowledgeDoc/deleteDocCorrection";
import { refreshLoreAfterCorrection } from "@/lib/knowledgeDoc/refreshLoreAfterCorrection";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles DELETE /api/artist/{id}/knowledge-doc/corrections/{correctionId}:
 * the claimant or an admin undoes a correction, and a Lore rebuild without it
 * is queued.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @param correctionId - The correction id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403 or 500 with `{ status, error }`.
 */
export async function deleteKnowledgeDocCorrectionHandler(
  request: Request,
  id: string,
  correctionId: string,
) {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    if (!z.uuid().safeParse(id).success) return error("artistId must be a UUID", 400);
    if (!z.uuid().safeParse(correctionId).success) return error("correctionId must be a UUID", 400);
    const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    await deleteDocCorrection(auth.artistId, correctionId, {
      userId: auth.userId,
      expectedClaimId,
    });
    await refreshLoreAfterCorrection(auth.artistId, expectedClaimId, auth.userId);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    console.error("[knowledge-doc/corrections] Undo failed", e);
    return error("Failed to undo", 500);
  }
}

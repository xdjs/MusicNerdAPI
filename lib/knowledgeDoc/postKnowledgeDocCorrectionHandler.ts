import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { refreshLoreAfterCorrection } from "@/lib/knowledgeDoc/refreshLoreAfterCorrection";
import { upsertDocCorrection } from "@/lib/knowledgeDoc/upsertDocCorrection";
import { validateKnowledgeDocCorrectionBody } from "@/lib/knowledgeDoc/validateKnowledgeDocCorrectionBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles POST /api/artist/{id}/knowledge-doc/corrections: the claimant or an
 * admin marks a Lore claim wrong or replaces it with their wording. The
 * document text is not edited: the correction is stored beside it and applied
 * on every rebuild, and a rebuild is queued so the artist sees it take effect.
 *
 * @param request - The request; a claimant or admin Privy token and `{ claim, kind, correction? }`.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403 or 500 with `{ status, error }`.
 */
export async function postKnowledgeDocCorrectionHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    if (!z.uuid().safeParse(id).success) return error("artistId must be a UUID", 400);
    // The claim is read before authorization, so a claim change meanwhile is caught.
    const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const body = validateKnowledgeDocCorrectionBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    await upsertDocCorrection(auth.artistId, body.claim, body.kind, body.correction, {
      userId: auth.userId,
      expectedClaimId,
    });
    await refreshLoreAfterCorrection(auth.artistId, expectedClaimId, auth.userId);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    console.error("[knowledge-doc/corrections] Save failed", e);
    return error("Failed to save your correction", 500);
  }
}

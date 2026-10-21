import { NextResponse } from "next/server";
import { saveArtistLinkOrder } from "@/lib/artistLinkOrder/saveArtistLinkOrder";
import { validateArtistLinkOrderBody } from "@/lib/artistLinkOrder/validateArtistLinkOrderBody";
import { getAllLinks } from "@/lib/artists/getAllLinks";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles PUT /api/artist/link-order: saves the order the claimant or an admin
 * dragged a link group into, under the ownership fence.
 *
 * @param request - The request; a Privy token and `{ artistId, section, order }`.
 * @returns 200 `{ status, success }`; 400, 401, 403, 404 or 500 `{ status, error }`.
 */
export async function putArtistLinkOrderHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = validateArtistLinkOrderBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const { artistId, section, order } = body;
    const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
    if (!(await canEditArtist(auth.userId, artistId)))
      return error("Not authorized for this artist", 403);
    const known = new Set(["spotify", "deezer", ...(await getAllLinks()).map(l => l.siteName)]);
    if (order.some(name => !known.has(name))) return error("Unknown platform", 400);
    const saved = await withArtistOperation(
      artistId,
      { userId: auth.userId, expectedClaimId },
      () => saveArtistLinkOrder(artistId, section, order),
    );
    if (!saved) return error("Artist not found", 404);
    return NextResponse.json({ status: "ok", success: true }, { status: 200, headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    console.error("[artist/link-order] Save failed", e);
    return error("Could not save link order", 500);
  }
}

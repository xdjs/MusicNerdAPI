import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateHeaderPositionBody } from "@/lib/artistImages/validateHeaderPositionBody";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Handles PATCH /api/artist/header-position: saves how far down the header
 * image is framed, with the image it applies to, under the ownership fence.
 *
 * @param request - The request; a claimant or admin Privy token, the position as JSON.
 * @returns 200 with `{ status, success }`; 400, 401, 403, 404 or 500.
 */
export async function patchHeaderPositionHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const body = await validateHeaderPositionBody(request);
  if (body instanceof NextResponse) return body;
  const { artistId, imageUrl, y } = body;
  try {
    const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
    if (!(await canEditArtist(auth.userId, artistId)))
      return error("Not authorized for this artist", 403);
    const updated = await withArtistOperation(
      artistId,
      { userId: auth.userId, expectedClaimId },
      () =>
        withScopedArtistWrite(artistId, tx =>
          tx
            .update(artists)
            .set({ headerImagePosition: { imageUrl, y } })
            .where(eq(artists.id, artistId))
            .returning({ id: artists.id }),
        ),
    );
    if (!updated.length) return error("Artist not found", 404);
    return NextResponse.json({ status: "ok", success: true }, { status: 200, headers });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error("Artist ownership changed", 403);
    return error("Could not save photo position", 500);
  }
}

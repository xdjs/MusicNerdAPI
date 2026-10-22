import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getProviderPhoto } from "@/lib/artistImages/getProviderPhoto";
import { validatePhotoChoiceBody } from "@/lib/artistImages/validatePhotoChoiceBody";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const STALE = "The profile changed. Close and reopen photo choices.";

/**
 * Handles PATCH /api/artist/photo-choice: sets the artist's photo to a
 * provider's, re-resolving it server-side and refusing a stale choice. The
 * saved header position survives only when it was set for this same image.
 *
 * @param request - The request; a claimant or admin Privy token, the choice as JSON.
 * @returns 200 with `{ status, success, imagePath, position }`; 400, 401, 403, 404, 409, 500 or 503.
 */
export async function patchPhotoChoiceHandler(request: Request): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return error("Not signed in", 401);
    const body = await validatePhotoChoiceBody(request);
    if (body instanceof NextResponse) return body;
    const { artistId, source, imageUrl, expectedCustomImage, providerId } = body;
    const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
    if (!(await canEditArtist(auth.userId, artistId)))
      return error("Not authorized for this artist", 403);
    const artist = await db.query.artists.findFirst({ where: eq(artists.id, artistId) });
    if (!artist) return error("Artist not found", 404);
    if (artist.customImage !== expectedCustomImage || artist[source]?.trim() !== providerId)
      return error(STALE, 409);
    const resolved = await getProviderPhoto(artist, source);
    if (!resolved) return error("That photo is unavailable. Your current photo is unchanged.", 503);
    if (resolved !== imageUrl)
      return error("That provider photo changed. Close and reopen photo choices.", 409);
    const updated = await withArtistOperation(
      artistId,
      { userId: auth.userId, expectedClaimId },
      () =>
        withScopedArtistWrite(artistId, tx =>
          tx
            .update(artists)
            .set({
              customImage: resolved,
              headerImagePosition: sql`CASE WHEN ${artists.headerImagePosition}->>'imageUrl' = ${resolved} THEN ${artists.headerImagePosition} ELSE NULL END`,
            })
            .where(
              and(
                eq(artists.id, artistId),
                sql`${artists.customImage} IS NOT DISTINCT FROM ${expectedCustomImage}`,
                sql`btrim(${artists[source]}) = ${providerId}`,
              ),
            )
            .returning({ imagePath: artists.customImage, position: artists.headerImagePosition }),
        ),
    );
    if (!updated.length) return error(STALE, 409);
    return NextResponse.json(
      {
        status: "ok",
        success: true,
        imagePath: updated[0]!.imagePath,
        position: updated[0]!.position?.y ?? 0,
      },
      { status: 200, headers },
    );
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error("Artist ownership changed", 403);
    return error("Could not save photo. Your current photo is unchanged.", 500);
  }
}

import { and, eq } from "drizzle-orm";
import { artistDocCorrections } from "@/lib/db/schema";
import { withArtistUploadWrite } from "@/lib/ownership/withArtistUploadWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";

/**
 * Removes one of the artist's Lore corrections, re-authorized under the artist
 * row lock. A correction that is already gone is not an error.
 *
 * @param artistId - The artist.
 * @param correctionId - The correction.
 * @param auth - The user and the claim the request started under.
 * @returns Nothing; throws OwnershipChangedError when the claim changed.
 */
export async function deleteDocCorrection(
  artistId: string,
  correctionId: string,
  auth: ArtistWriteAuth,
): Promise<void> {
  await withArtistUploadWrite(artistId, auth.userId, auth.expectedClaimId, async tx => {
    await tx
      .delete(artistDocCorrections)
      .where(
        and(eq(artistDocCorrections.id, correctionId), eq(artistDocCorrections.artistId, artistId)),
      );
  });
}

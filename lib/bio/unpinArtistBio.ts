import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistBioVersions } from "@/lib/db/schema";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";

/**
 * Unpins the artist's bio under the artist row lock. The bio text is unchanged.
 *
 * @param artistId - The artist.
 * @param auth - The user and the claim the request started under.
 * @returns Nothing. Throws OwnershipChangedError.
 */
export async function unpinArtistBio(artistId: string, auth: ArtistWriteAuth): Promise<void> {
  await db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, auth);
    await tx
      .update(artistBioVersions)
      .set({ isPinned: false })
      .where(eq(artistBioVersions.artistId, artistId));
  });
}

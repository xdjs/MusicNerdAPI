import { and, eq } from "drizzle-orm";
import { saveBioVersions } from "@/lib/bio/saveBioVersions";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistBioVersions, artists } from "@/lib/db/schema";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";

/**
 * Pins one saved bio and makes it the artist's bio, in one transaction under
 * the artist row lock. The bio it replaces is kept in the history first.
 *
 * @param versionId - The saved bio to pin.
 * @param artistId - The artist; the version must be theirs.
 * @param auth - The user and the claim the request started under.
 * @returns The pinned version, or undefined when the artist has no such version. Throws OwnershipChangedError.
 */
export async function pinBioVersion(versionId: string, artistId: string, auth: ArtistWriteAuth) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, auth);
    const ofArtist = and(
      eq(artistBioVersions.id, versionId),
      eq(artistBioVersions.artistId, artistId),
    );
    const selected = await tx.query.artistBioVersions.findFirst({ where: ofArtist });
    if (!selected) return undefined;
    const current = await tx.query.artists.findFirst({ where: eq(artists.id, artistId) });
    await saveBioVersions(tx, artistId, [current?.bio]);
    await tx
      .update(artistBioVersions)
      .set({ isPinned: false })
      .where(eq(artistBioVersions.artistId, artistId));
    const [pinned] = await tx
      .update(artistBioVersions)
      .set({ isPinned: true })
      .where(ofArtist)
      .returning();
    if (pinned)
      await tx.update(artists).set({ bio: pinned.bioText }).where(eq(artists.id, artistId));
    return pinned;
  });
}

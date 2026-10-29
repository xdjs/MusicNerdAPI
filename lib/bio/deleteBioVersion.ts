import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistBioVersions } from "@/lib/db/schema";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";

/**
 * Deletes one saved bio under the artist row lock, so it can't race a pin.
 * The pinned bio is kept.
 *
 * @param versionId - The saved bio.
 * @param artistId - The artist; the version must be theirs.
 * @param auth - The user and the claim the request started under.
 * @returns `deleted`, `not_found` or `pinned`. Throws OwnershipChangedError.
 */
export async function deleteBioVersion(
  versionId: string,
  artistId: string,
  auth: ArtistWriteAuth,
): Promise<"deleted" | "not_found" | "pinned"> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, auth);
    const ofArtist = and(
      eq(artistBioVersions.id, versionId),
      eq(artistBioVersions.artistId, artistId),
    );
    const version = await tx.query.artistBioVersions.findFirst({ where: ofArtist });
    if (!version) return "not_found";
    if (version.isPinned) return "pinned";
    await tx.delete(artistBioVersions).where(ofArtist);
    return "deleted";
  });
}

import { acquireArtistIdentityLock } from "@/lib/artistLinks/acquireArtistIdentityLock";
import type { ArtistIdentityLockExecutor } from "@/lib/artistLinks/types";

/**
 * Serializes the same-name check and the insert when adding an artist. The
 * key matches MusicNerdWeb's.
 *
 * @param database - The add's transaction.
 * @param normalisedName - The artist's `lcname`.
 * @returns Once the lock is held.
 */
export async function acquireArtistNameLock(
  database: ArtistIdentityLockExecutor,
  normalisedName: string,
): Promise<void> {
  await acquireArtistIdentityLock(database, `musicnerd:artist-name:${normalisedName}`);
}

import { acquireArtistIdentityLock } from "@/lib/artistLinks/acquireArtistIdentityLock";
import type { ArtistIdentityLockExecutor } from "@/lib/artistLinks/types";

/**
 * Serializes every id write for one artist/platform slot, even when writers
 * propose different ids. The key matches MusicNerdWeb's.
 *
 * @param database - The protected write's transaction.
 * @param artistId - The artist.
 * @param platform - The platform.
 * @returns Once the lock is held.
 */
export async function acquireArtistPlatformLock(
  database: ArtistIdentityLockExecutor,
  artistId: string,
  platform: string,
): Promise<void> {
  await acquireArtistIdentityLock(
    database,
    `musicnerd:artist-platform-slot:${artistId}:${platform}`,
  );
}

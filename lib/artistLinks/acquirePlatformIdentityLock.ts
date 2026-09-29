import { acquireArtistIdentityLock } from "@/lib/artistLinks/acquireArtistIdentityLock";
import type { ArtistIdentityLockExecutor } from "@/lib/artistLinks/types";

/**
 * Serializes ownership decisions for one external platform identity. The key
 * matches MusicNerdWeb's, so both apps serialize against each other.
 *
 * @param database - The protected write's transaction.
 * @param platform - The platform.
 * @param platformId - The external id.
 * @returns Once the lock is held.
 */
export async function acquirePlatformIdentityLock(
  database: ArtistIdentityLockExecutor,
  platform: string,
  platformId: string,
): Promise<void> {
  await acquireArtistIdentityLock(database, `musicnerd:artist-platform:${platform}:${platformId}`);
}

import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";
import { acquirePlatformIdentityLock } from "@/lib/artistLinks/acquirePlatformIdentityLock";
import type { ArtistIdentityLockExecutor } from "@/lib/artistLinks/types";

/**
 * Both locks a platform-identity write needs, slot first, so every writer
 * takes them in the same order.
 *
 * @param database - The protected write's transaction.
 * @param artistId - The artist.
 * @param platform - The platform.
 * @param platformId - The external id.
 * @returns Once both locks are held.
 */
export async function acquireArtistPlatformWriteLocks(
  database: ArtistIdentityLockExecutor,
  artistId: string,
  platform: string,
  platformId: string,
): Promise<void> {
  await acquireArtistPlatformLock(database, artistId, platform);
  await acquirePlatformIdentityLock(database, platform, platformId);
}

import type { ArtistPlatformIdentity } from "@/lib/addArtist/types";

/**
 * Identities in one fixed order (platform, then id), so concurrent adds take
 * their locks in the same order and can't deadlock.
 *
 * @param identities - The identities.
 * @returns A sorted copy.
 */
export function sortArtistPlatformIdentities(
  identities: ArtistPlatformIdentity[],
): ArtistPlatformIdentity[] {
  return [...identities].sort(
    (left, right) =>
      left.platform.localeCompare(right.platform) ||
      left.platformId.localeCompare(right.platformId),
  );
}

import type { ExtractedArtistId } from "@/lib/artists/types";

/**
 * Reads a facebook match: group 1 is a /people/<name>/<id> id, group 2 a
 * profile.php?id=<id> id (both the `facebookID` column), group 3 a username.
 *
 * @param match - The urlmap regex match.
 * @param cardPlatformName - The row's display name.
 * @returns The reading; null for a bare profile.php; undefined to fall through.
 */
export function matchFacebook(
  match: RegExpMatchArray,
  cardPlatformName: string | null,
): ExtractedArtistId | null | undefined {
  const [, peopleId, profileId, username] = match;
  if (peopleId || profileId)
    return { siteName: "facebookID", cardPlatformName, id: peopleId || profileId };
  if (!username) return undefined;
  if (username.startsWith("profile.php")) return null;
  return { siteName: "facebook", cardPlatformName, id: username };
}

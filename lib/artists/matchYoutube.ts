import type { ExtractedArtistId } from "@/lib/artists/types";
import { withoutAt } from "@/lib/artists/withoutAt";

/**
 * Reads a youtube match: group 2 is an @username, group 3 a plain username.
 *
 * @param match - The urlmap regex match.
 * @param cardPlatformName - The row's display name.
 * @returns The reading, or undefined to fall through to the generic reading.
 */
export function matchYoutube(
  match: RegExpMatchArray,
  cardPlatformName: string | null,
): ExtractedArtistId | undefined {
  const username = match[2] || match[3];
  return username ? { siteName: "youtube", cardPlatformName, id: withoutAt(username) } : undefined;
}

import type { ExtractedArtistId } from "@/lib/artists/types";
import { withoutAt } from "@/lib/artists/withoutAt";

/**
 * Reads a youtubechannel match: group 2 is a channel id, group 3 an @username,
 * group 4 a plain username. Usernames belong to the `youtube` column.
 *
 * @param match - The urlmap regex match.
 * @param cardPlatformName - The row's display name.
 * @returns The reading, or undefined to fall through to the generic reading.
 */
export function matchYoutubeChannel(
  match: RegExpMatchArray,
  cardPlatformName: string | null,
): ExtractedArtistId | undefined {
  const [, , channelId, atUsername, plainUsername] = match;
  if (channelId) return { siteName: "youtubechannel", cardPlatformName, id: channelId };
  if (atUsername) return { siteName: "youtube", cardPlatformName, id: withoutAt(atUsername) };
  if (plainUsername) return { siteName: "youtube", cardPlatformName, id: withoutAt(plainUsername) };
  return undefined;
}

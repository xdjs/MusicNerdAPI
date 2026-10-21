import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import { getUserDisplayName } from "@/lib/users/getUserDisplayName";

/**
 * Tells the team's Discord that a link was added, in MusicNerdWeb's wording.
 *
 * @param notification - Who added what.
 * @param notification.user - The user's username and wallet, for the display name.
 * @param notification.artistName - The artist.
 * @param notification.platformName - The platform's display name.
 * @param notification.platformId - The id written.
 * @param notification.submittedUrl - The URL the user submitted.
 * @param notification.createdAt - When; now by default.
 * @returns Once posted.
 */
export async function notifyDiscordOfArtistLinkAdded({
  user,
  artistName,
  platformName,
  platformId,
  submittedUrl,
  createdAt = new Date().toISOString(),
}: {
  user: { username?: string | null; wallet?: string | null };
  artistName: string;
  platformName: string;
  platformId: string;
  submittedUrl: string;
  createdAt?: string;
}): Promise<void> {
  await sendDiscordMessage(
    `${getUserDisplayName(user)} added ${artistName}'s ${platformName}: ${platformId} (Submitted URL: ${submittedUrl}) ${createdAt}`,
  );
}

import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import type { MusicPlatform } from "@/lib/musicPlatform/types";
import { getUserById } from "@/lib/users/getUserById";
import { getUserDisplayName } from "@/lib/users/getUserDisplayName";

/**
 * Tells the team's Discord that a user added an artist, in MusicNerdWeb's wording.
 *
 * @param added - Who added whom.
 * @param added.userId - The user.
 * @param added.artistName - The new artist.
 * @param added.platform - The submitted platform.
 * @param added.platformId - The submitted id.
 * @param added.createdAt - When the artist was created.
 * @returns Once posted. Never throws.
 */
export async function notifyDiscordOfArtistAdded(added: {
  userId: string;
  artistName: string;
  platform: MusicPlatform;
  platformId: string;
  createdAt: string | null;
}): Promise<void> {
  try {
    const user = await getUserById(added.userId);
    if (!user) return;
    await sendDiscordMessage(
      `${getUserDisplayName(user)} added new artist named: ${added.artistName} (Submitted ${added.platform}Id: ${added.platformId}) ${added.createdAt ?? ""}`,
    );
  } catch (e) {
    console.error("[notifyDiscordOfArtistAdded] Failed to send artist-added notification:", e);
  }
}

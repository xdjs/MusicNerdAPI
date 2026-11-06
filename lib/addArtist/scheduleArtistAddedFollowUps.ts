import { after } from "next/server";
import { notifyDiscordOfArtistAdded } from "@/lib/addArtist/notifyDiscordOfArtistAdded";
import { wakeDirectoryDiscovery } from "@/lib/addArtist/wakeDirectoryDiscovery";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

/**
 * After the response: wake the new artist's queued directory research and
 * tell Discord. Neither may hold the user up or fail the add.
 *
 * @param added - The new artist and who added it.
 * @param added.origin - This API's origin.
 * @param added.userId - The user.
 * @param added.artistId - The new artist.
 * @param added.artistName - Their name.
 * @param added.platform - The submitted platform.
 * @param added.platformId - The submitted id, as the platform returned it.
 * @param added.createdAt - When the artist was created.
 */
export function scheduleArtistAddedFollowUps(added: {
  origin: string;
  userId: string;
  artistId: string;
  artistName: string;
  platform: MusicPlatform;
  platformId: string;
  createdAt: string | null;
}): void {
  try {
    after(async () => {
      if (!(await wakeDirectoryDiscovery(added.origin, added.artistId)))
        console.warn("[directoryDiscovery] Wake did not finish; committed work remains queued.");
    });
    after(() =>
      notifyDiscordOfArtistAdded({
        userId: added.userId,
        artistName: added.artistName,
        platform: added.platform,
        platformId: added.platformId,
        createdAt: added.createdAt,
      }),
    );
  } catch (e) {
    console.error("[addArtist] Could not schedule the follow-ups:", e);
  }
}

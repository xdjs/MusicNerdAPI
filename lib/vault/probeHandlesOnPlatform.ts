import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";

/**
 * Probes every verified handle on one platform. A handle counts only when its
 * page title names the artist: Bandcamp and Twitch answer for handles nobody
 * owns. A scan cut short by the deadline says so, since one answer out of a
 * partial scan is indistinguishable from exactly one answer.
 *
 * @param artistId - The artist.
 * @param platform - The platform column.
 * @param pattern - The urlmap profile template, with "%@" for the handle.
 * @param handles - The verified handles.
 * @param artistName - Their name.
 * @param deadline - When to stop (epoch ms).
 * @returns The handles that answered as the artist, and whether every handle was checked.
 */
export async function probeHandlesOnPlatform(
  artistId: string,
  platform: string,
  pattern: string,
  handles: string[],
  artistName: string,
  deadline: number,
): Promise<{ resolved: string[]; scannedAll: boolean }> {
  const resolved: string[] = [];
  for (const handle of handles) {
    if (Date.now() > deadline) return { resolved, scannedAll: false };
    if (isReservedHandle(platform, handle)) continue;
    if (await handleBelongsToAnotherArtist(artistId, platform, handle)) continue;
    if (await contradictsScrapedPosts(artistId, platform, handle)) continue;
    if (Date.now() > deadline) return { resolved, scannedAll: false };
    const preview = await fetchLinkPreview(pattern.replace("%@", handle)).catch(() => null);
    if (Date.now() > deadline) return { resolved, scannedAll: false };
    if (preview?.title && titleMatchesArtist(preview.title, artistName)) resolved.push(handle);
  }
  return { resolved, scannedAll: true };
}

import { isTheSameTrack } from "@/lib/trackLinks/isTheSameTrack";
import type { TrackLookup } from "@/lib/trackLinks/types";
import { withProviderTimeout } from "@/lib/trackLinks/withProviderTimeout";

/**
 * The record on Deezer, through its public search.
 *
 * @param title - The title.
 * @param artist - The artist.
 * @param isAlbum - Whether the record is an album.
 * @returns The link, null for no match, undefined when Deezer could not be searched.
 */
export async function deezerTrackLink(
  title: string,
  artist: string,
  isAlbum: boolean,
): Promise<TrackLookup> {
  const q = encodeURIComponent(`${artist} ${title}`);
  const path = isAlbum ? "search/album" : "search";
  const res = await withProviderTimeout(fetch(`https://api.deezer.com/${path}?q=${q}&limit=5`));
  if (!res?.ok) return undefined;
  const body = (await res.json().catch(() => undefined)) as
    { data?: Array<{ title?: string; link?: string; artist?: { name?: string } }> } | undefined;
  if (!body) return undefined;
  for (const r of body?.data ?? []) {
    if (!r.title || !r.link) continue;
    if (isTheSameTrack(r.title, r.artist?.name ?? "", title, artist)) {
      return { service: "Deezer", url: r.link };
    }
  }
  return null;
}

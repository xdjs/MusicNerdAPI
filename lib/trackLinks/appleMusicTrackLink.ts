import { isTheSameTrack } from "@/lib/trackLinks/isTheSameTrack";
import type { TrackLookup } from "@/lib/trackLinks/types";
import { withProviderTimeout } from "@/lib/trackLinks/withProviderTimeout";

/**
 * The record on Apple Music, through the open iTunes Search API. An album is
 * searched as an album: `entity=song` returns its tracks or nothing.
 *
 * @param title - The title.
 * @param artist - The artist.
 * @param isAlbum - Whether the record is an album.
 * @returns The link, null for no match, undefined when Apple could not be searched.
 */
export async function appleMusicTrackLink(
  title: string,
  artist: string,
  isAlbum: boolean,
): Promise<TrackLookup> {
  const term = encodeURIComponent(`${artist} ${title}`);
  const entity = isAlbum ? "album" : "song";
  const res = await withProviderTimeout(
    fetch(`https://itunes.apple.com/search?term=${term}&entity=${entity}&limit=5`),
  );
  if (!res?.ok) return undefined;
  const body = (await res.json().catch(() => undefined)) as
    | {
        results?: Array<{
          trackName?: string;
          collectionName?: string;
          artistName?: string;
          trackViewUrl?: string;
          collectionViewUrl?: string;
        }>;
      }
    | undefined;
  if (!body) return undefined;
  for (const r of body?.results ?? []) {
    const name = isAlbum ? r.collectionName : r.trackName;
    const link = isAlbum ? r.collectionViewUrl : r.trackViewUrl;
    if (!name || !link) continue;
    if (isTheSameTrack(name, r.artistName ?? "", title, artist)) {
      // The `uo=4` parameter Apple appends is noise on a link shown to a fan.
      return { service: "Apple Music", url: link.split("?")[0] };
    }
  }
  return null;
}

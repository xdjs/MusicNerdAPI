import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { getArtistImage } from "@/lib/musicPlatform/getArtistImage";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import type { SpotifyHeaders } from "@/lib/spotify/types";

/**
 * Thumbnail images for several artists, ten at a time, keyed by artist id;
 * artists without one are left out. One Spotify token serves the whole
 * batch (MusicNerdWeb cached its token; this API fetches one per call).
 *
 * @param artists - The artists' ids, uploads and platform ids.
 * @returns Artist id to image URL.
 */
export async function getArtistImages(
  artists: {
    id: string;
    customImage?: string | null;
    spotify?: string | null;
    deezer?: string | null;
  }[],
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const needsSpotify = artists.some(a => a.spotify?.trim() && !a.customImage?.trim());
  const headers: SpotifyHeaders | null = needsSpotify
    ? await getSpotifyHeaders().catch(() => null)
    : null;
  for await (const [artist, image] of mapWithConcurrency(artists, 10, a =>
    getArtistImage(a, headers),
  )) {
    if (image) imageMap.set(artist.id, image);
  }
  return imageMap;
}

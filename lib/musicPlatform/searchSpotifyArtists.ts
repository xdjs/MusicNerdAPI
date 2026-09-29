import { mapSpotifyArtist } from "@/lib/musicPlatform/mapSpotifyArtist";
import type { MusicPlatformArtist, SpotifyArtistPayload } from "@/lib/musicPlatform/types";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { readSpotifyJson } from "@/lib/spotify/readSpotifyJson";

/**
 * Spotify's artist search by name. Each call fetches a fresh token, so
 * MusicNerdWeb's refresh-and-retry on a 401 has nothing to do here.
 *
 * @param query - The artist name.
 * @param limit - Maximum results.
 * @returns The matches, without album counts or top tracks; empty on any error.
 */
export async function searchSpotifyArtists(
  query: string,
  limit: number,
): Promise<MusicPlatformArtist[]> {
  try {
    const headers = await getSpotifyHeaders();
    const data = await readSpotifyJson(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`,
      headers,
    );
    const items = (data.artists as { items?: SpotifyArtistPayload[] } | undefined)?.items ?? [];
    return items.map(artist => mapSpotifyArtist(artist, 0, null));
  } catch (e) {
    console.error("[searchSpotifyArtists] Search failed:", (e as Error)?.message);
    return [];
  }
}

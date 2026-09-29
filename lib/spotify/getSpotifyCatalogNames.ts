import { readSpotifyJson } from "@/lib/spotify/readSpotifyJson";
import type { SpotifyHeaders } from "@/lib/spotify/types";

/**
 * The artist's release and top-track names from Spotify: the catalog the
 * relevance judge uses as evidence a namesake can't fake. No cache, unlike
 * MusicNerdWeb: this runs in background jobs with no Next request context.
 *
 * @param id - The artist's Spotify id.
 * @param headers - Bearer headers from `getSpotifyHeaders`.
 * @returns Up to 15 distinct release names and 8 top tracks. A failed half is empty; the other half is kept.
 */
export async function getSpotifyCatalogNames(
  id: string | null,
  headers: SpotifyHeaders,
): Promise<{ releases: string[]; topTracks: string[] }> {
  if (!id) return { releases: [], topTracks: [] };
  const [albums, tracks] = await Promise.allSettled([
    readSpotifyJson(
      `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album%2Csingle&limit=20&market=US`,
      headers,
    ),
    readSpotifyJson(`https://api.spotify.com/v1/artists/${id}/top-tracks?market=US`, headers),
  ]);
  const releases =
    albums.status === "fulfilled"
      ? Array.from(
          new Set(
            ((albums.value.items ?? []) as Array<{ name?: string }>)
              .map(a => a.name)
              .filter((n): n is string => !!n),
          ),
        ).slice(0, 15)
      : [];
  const topTracks =
    tracks.status === "fulfilled"
      ? ((tracks.value.tracks ?? []) as Array<{ name?: string }>)
          .map(t => t.name)
          .filter((n): n is string => !!n)
          .slice(0, 8)
      : [];
  return { releases, topTracks };
}

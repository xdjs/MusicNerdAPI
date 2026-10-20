import type { SpotifyHeaders } from "@/lib/spotify/types";
import type { SpotifyArtist } from "@/lib/spotify/fetchSpotifyArtist";
import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";

/**
 * Fetch multiple Spotify artists in one batched call (max 50).
 *
 * @param artistIds - Array of Spotify artist IDs.
 * @param headers - Bearer auth headers from `getSpotifyHeaders`.
 * @returns Array of Spotify artist objects.
 */
export async function fetchSpotifyArtists(
  artistIds: string[],
  headers: SpotifyHeaders,
): Promise<SpotifyArtist[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < artistIds.length; i += 50) {
    chunks.push(artistIds.slice(i, i + 50));
  }
  const results = await Promise.all(
    chunks.map(async chunk => {
      const res = await fetchSpotifyResponse(
        `https://api.spotify.com/v1/artists?ids=${chunk.join(",")}`,
        { headers: headers.headers, signal: AbortSignal.timeout(5_000) },
      );
      if (!res.ok) return [];
      const body = (await res.json()) as { artists: SpotifyArtist[] };
      return body?.artists ?? [];
    }),
  );
  return results.flat();
}

import { readSpotifyJson } from "@/lib/spotify/readSpotifyJson";
import type { SpotifyHeaders } from "@/lib/spotify/types";
import { SPOTIFY_BATCH_MAX } from "@/lib/spotifyData/const";
import type { SpotifyArtistData } from "@/lib/spotifyData/types";

/**
 * Several Spotify artists in one call per 50 ids, in request order, as
 * MusicNerdWeb's `getSpotifyArtists` fetched them. Spotify answers `null`
 * for an id it does not know; that is passed through.
 *
 * @param artistIds - The Spotify artist ids.
 * @param headers - Bearer headers from `getSpotifyHeaders`.
 * @returns The artists; throws when Spotify does.
 */
export async function getSpotifyArtistsData(
  artistIds: string[],
  headers: SpotifyHeaders,
): Promise<(SpotifyArtistData | null)[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < artistIds.length; i += SPOTIFY_BATCH_MAX)
    chunks.push(artistIds.slice(i, i + SPOTIFY_BATCH_MAX));
  const results = await Promise.all(
    chunks.map(chunk =>
      readSpotifyJson(`https://api.spotify.com/v1/artists?ids=${chunk.join(",")}`, headers),
    ),
  );
  return results.flatMap(response => (response.artists ?? []) as (SpotifyArtistData | null)[]);
}

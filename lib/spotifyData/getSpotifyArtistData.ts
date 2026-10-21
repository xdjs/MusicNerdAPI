import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
import type { SpotifyHeaders } from "@/lib/spotify/types";
import type { SpotifyArtistApiResponse, SpotifyArtistData } from "@/lib/spotifyData/types";

/**
 * One Spotify artist, with MusicNerdWeb's `getSpotifyArtist` answers: the
 * object as Spotify returns it (images, genres and followers defaulted), or
 * an `error` naming what went wrong. Never throws.
 *
 * @param artistId - The Spotify artist id.
 * @param headers - Bearer headers from `getSpotifyHeaders`.
 * @returns `{ data, error }`.
 */
export async function getSpotifyArtistData(
  artistId: string,
  headers: SpotifyHeaders,
): Promise<SpotifyArtistApiResponse> {
  if (!headers?.headers?.Authorization) {
    console.error("Missing Spotify authorization header");
    return { error: "Spotify authentication failed", data: null };
  }
  try {
    const res = await fetchSpotifyResponse(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`,
      { headers: headers.headers, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      console.error("Error fetching Spotify data for artist", { artistId, status: res.status });
      if (res.status === 404 || body?.error?.message === "invalid id")
        return { error: "Invalid Spotify ID", data: null };
      if (res.status === 401) return { error: "Spotify authentication failed", data: null };
      if (res.status === 429)
        return { error: "Rate limit exceeded, please try again later", data: null };
      return { error: "Failed to fetch artist data from Spotify", data: null };
    }
    const data = (await res.json()) as Partial<SpotifyArtistData> | null;
    if (!data) {
      console.error("No data returned from Spotify API");
      return { error: "No data returned from Spotify", data: null };
    }
    if (!data.name || !data.id) {
      console.error("Invalid Spotify artist data - missing required fields:", data);
      return { error: "Invalid artist data format from Spotify", data: null };
    }
    return {
      error: null,
      data: {
        ...data,
        id: data.id,
        name: data.name,
        images: Array.isArray(data.images) ? data.images : [],
        genres: Array.isArray(data.genres) ? data.genres : [],
        followers: data.followers || { total: 0 },
      },
    };
  } catch (e) {
    console.error("Error fetching Spotify data for artist", { artistId, error: e });
    if (e instanceof SpotifyDeferredError)
      return { error: "Rate limit exceeded, please try again later", data: null };
    return { error: "Network error while fetching artist data", data: null };
  }
}

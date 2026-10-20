import type { SpotifyHeaders } from "@/lib/spotify/types";
import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";

export type SpotifyArtist = {
  name: string;
  id: string;
  images: Array<{ url: string; height: number; width: number }>;
  followers: { total: number };
  genres: string[];
  type: string;
  uri: string;
  external_urls: { spotify: string };
};

export type SpotifyArtistApiResponse = {
  error: string | null;
  data: SpotifyArtist | null;
};

/**
 * Fetch a single Spotify artist by ID.
 *
 * @param artistId - The Spotify artist ID.
 * @param headers - Bearer auth headers from `getSpotifyHeaders`.
 * @returns The artist data or an error.
 */
export async function fetchSpotifyArtist(
  artistId: string,
  headers: SpotifyHeaders,
): Promise<SpotifyArtistApiResponse> {
  try {
    const res = await fetchSpotifyResponse(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`,
      { headers: headers.headers, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) {
      if (res.status === 404) return { error: "Invalid Spotify ID", data: null };
      if (res.status === 401) return { error: "Spotify authentication failed", data: null };
      return { error: "Failed to fetch artist data from Spotify", data: null };
    }
    const data = (await res.json()) as SpotifyArtist;
    if (!data?.name || !data?.id)
      return { error: "Invalid artist data format from Spotify", data: null };
    return {
      data: {
        ...data,
        images: Array.isArray(data.images) ? data.images : [],
        genres: Array.isArray(data.genres) ? data.genres : [],
        followers: data.followers ?? { total: 0 },
      },
      error: null,
    };
  } catch {
    return { error: "Failed to fetch artist data from Spotify", data: null };
  }
}

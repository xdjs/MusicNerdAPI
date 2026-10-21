import { fetchSpotifyOEmbed } from "@/lib/pages/fetchSpotifyOEmbed";
import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";
import type { SpotifyHeaders } from "@/lib/spotify/types";

/**
 * A Spotify artist's first image, as MusicNerdWeb's
 * `SpotifyProvider.getArtistImage` found it: the Web API when a token is at
 * hand, else Spotify's public oEmbed thumbnail (https, on Spotify's CDN),
 * which needs no token. The request host is fixed; a URL from the artist
 * record is never fetched. Not cached, unlike MusicNerdWeb's 24-hour copy.
 *
 * @param id - The Spotify artist id.
 * @param headers - Bearer headers from `getSpotifyHeaders`, or null to skip the Web API.
 * @returns The image URL, or null.
 */
export async function getSpotifyArtistImage(
  id: string,
  headers: SpotifyHeaders | null,
): Promise<string | null> {
  if (headers) {
    try {
      const res = await fetchSpotifyResponse(
        `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`,
        { headers: headers.headers, signal: AbortSignal.timeout(2_000) },
      );
      if (res.ok) {
        const data = (await res.json()) as { images?: { url?: unknown }[] };
        const url = data?.images?.[0]?.url;
        if (typeof url === "string" && url) return url;
      }
    } catch (error) {
      console.error("[getSpotifyArtistImage] Web API failed:", error);
    }
  }
  const { imageUrl } = await fetchSpotifyOEmbed(
    `https://open.spotify.com/artist/${encodeURIComponent(id)}`,
  );
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    return url.hostname === "i.scdn.co" || url.hostname.endsWith(".spotifycdn.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

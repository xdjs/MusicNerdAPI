import { EMPTY_PREVIEW, PREVIEW_TIMEOUT_MS, SPOTIFY_OEMBED_ENDPOINT } from "@/lib/pages/const";
import type { LinkPreview } from "@/lib/pages/types";

/**
 * Spotify's official oEmbed: the real artist photo, no scraping, no auth.
 *
 * @param url - An open.spotify.com URL.
 * @returns The https thumbnail and title; nulls on any failure.
 */
export async function fetchSpotifyOEmbed(url: string): Promise<LinkPreview> {
  try {
    const res = await fetch(`${SPOTIFY_OEMBED_ENDPOINT}${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    if (!res.ok) return EMPTY_PREVIEW;
    const data = await res.json();
    const imageUrl =
      typeof data?.thumbnail_url === "string" && data.thumbnail_url.startsWith("https://")
        ? data.thumbnail_url
        : null;
    const title = typeof data?.title === "string" ? data.title : null;
    return { imageUrl, title };
  } catch {
    return EMPTY_PREVIEW;
  }
}

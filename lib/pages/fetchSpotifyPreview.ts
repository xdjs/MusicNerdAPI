import { fetchOgPreview } from "@/lib/pages/fetchOgPreview";
import { fetchSpotifyOEmbed } from "@/lib/pages/fetchSpotifyOEmbed";
import type { LinkPreview } from "@/lib/pages/types";

/**
 * A Spotify preview: oEmbed first, and the page scrape when oEmbed has no image.
 *
 * @param url - An open.spotify.com URL.
 * @returns The preview, keeping oEmbed's title when the scrape has none.
 */
export async function fetchSpotifyPreview(url: string): Promise<LinkPreview> {
  const oembed = await fetchSpotifyOEmbed(url);
  if (oembed.imageUrl) return oembed;
  const scraped = await fetchOgPreview(url);
  return { imageUrl: scraped.imageUrl, title: scraped.title ?? oembed.title };
}

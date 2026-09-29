import { EMPTY_PREVIEW } from "@/lib/pages/const";
import { fetchOgPreview } from "@/lib/pages/fetchOgPreview";
import { fetchSpotifyPreview } from "@/lib/pages/fetchSpotifyPreview";
import { isSpotifyUrl } from "@/lib/pages/isSpotifyUrl";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import type { LinkPreview } from "@/lib/pages/types";

/**
 * A link preview (image and title) for a URL that may come from an artist.
 * SSRF-guarded; Spotify prefers oEmbed; everything else is scraped. JS-walled
 * sites (X, Apple Music) resolve to nulls, not an error. Never throws.
 *
 * @param url - The link.
 * @returns The preview; nulls on any failure.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  try {
    if (!url || isUnsafeUrl(url)) return EMPTY_PREVIEW;
    return isSpotifyUrl(url) ? await fetchSpotifyPreview(url) : await fetchOgPreview(url);
  } catch {
    return EMPTY_PREVIEW;
  }
}

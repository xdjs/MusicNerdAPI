import { BOT_USER_AGENT, EMPTY_PREVIEW, PREVIEW_TIMEOUT_MS } from "@/lib/pages/const";
import { extractOgImage } from "@/lib/pages/extractOgImage";
import { extractOgTitle } from "@/lib/pages/extractOgTitle";
import type { LinkPreview } from "@/lib/pages/types";
import { fetchWithTimeout } from "@/lib/networking/fetchWithTimeout";

/**
 * A generic og:image/og:title scrape with the bot UA, which clears Spotify's
 * and Instagram's bot checks where a browser UA is blocked.
 *
 * @param url - The page.
 * @returns The image and title; nulls on any failure.
 */
export async function fetchOgPreview(url: string): Promise<LinkPreview> {
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": BOT_USER_AGENT } },
      PREVIEW_TIMEOUT_MS,
    );
    if (!res || !res.ok) return EMPTY_PREVIEW;
    const html = await res.text();
    return { imageUrl: extractOgImage(html), title: extractOgTitle(html) };
  } catch {
    return EMPTY_PREVIEW;
  }
}

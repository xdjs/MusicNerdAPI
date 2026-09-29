import { decodePodcastAttribute } from "@/lib/pages/decodePodcastAttribute";
import type { PodcastEpisodeIdentity } from "@/lib/pages/types";

/**
 * The Buzzsprout recording an Apple Podcasts or iHeart episode page plays.
 * Only recognized episode pages may claim a recording, and a page embedding
 * more than one recording has no identity.
 *
 * @param url - The page's URL.
 * @param html - The page's HTML.
 * @returns The recording's key with show and episode titles, or null.
 */
export function extractPodcastEpisodeIdentity(
  url: string,
  html: string,
): PodcastEpisodeIdentity | null {
  let provider: "apple" | "iheart";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "podcasts.apple.com" &&
      parsed.searchParams.has("i") &&
      /^\d+$/.test(parsed.searchParams.get("i") ?? "")
    ) {
      provider = "apple";
    } else if (
      (parsed.hostname === "iheart.com" || parsed.hostname === "www.iheart.com") &&
      /\/podcast\/[^/]+\/episode\/[^/]+/.test(parsed.pathname)
    ) {
      provider = "iheart";
    } else {
      return null;
    }
  } catch {
    return null;
  }

  const recordings = new Set<string>();
  for (const match of html.matchAll(
    /https:\/\/(?:www\.)?buzzsprout\.com\/(\d+)\/episodes\/(\d+)[^\s"'<>\\]*/gi,
  )) {
    recordings.add(`buzzsprout:${match[1]}:${match[2]}`);
    if (recordings.size > 1) return null;
  }
  if (recordings.size !== 1) return null;
  const [, showId, episodeId] = [...recordings][0].split(":");
  if (
    provider === "apple" &&
    (!html.includes(`Buzzsprout-${episodeId}`) ||
      !html.includes(`https://rss.buzzsprout.com/${showId}.rss`))
  )
    return null;

  let rawTitle: string | undefined;
  for (const [tag] of html.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    if (!/\bproperty\s*=\s*(["'])og:title\1/i.test(tag)) continue;
    const content = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (content) {
      rawTitle = decodePodcastAttribute(content);
      break;
    }
  }
  const series =
    provider === "apple"
      ? html.match(/"partOfSeries"\s*:\s*\{[^}]{0,500}"name"\s*:\s*"([^"\\]+)"/i)?.[1]
      : rawTitle?.match(/\s{2,}(.+?)\s*\|\s*iHeart$/i)?.[1];
  const episodeTitle =
    provider === "iheart" ? rawTitle?.replace(/\s{2,}.+?\s*\|\s*iHeart$/i, "").trim() : rawTitle;

  return {
    podcastEpisodeKey: [...recordings][0],
    podcastShowTitle: series ? decodePodcastAttribute(series) : undefined,
    podcastEpisodeTitle: episodeTitle || undefined,
  };
}

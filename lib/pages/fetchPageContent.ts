import { BOT_USER_AGENT, DEFAULT_FETCH_TIMEOUT_MS, EXTRACT_MAX_CHARS } from "@/lib/pages/const";
import { decodeEntities } from "@/lib/pages/decodeEntities";
import { extractArticleLinks } from "@/lib/pages/extractArticleLinks";
import { extractOgImage } from "@/lib/pages/extractOgImage";
import { extractOutboundLinks } from "@/lib/pages/extractOutboundLinks";
import { extractPodcastEpisodeIdentity } from "@/lib/pages/extractPodcastEpisodeIdentity";
import { extractPublishedDate } from "@/lib/pages/extractPublishedDate";
import { extractReadableText } from "@/lib/pages/extractReadableText";
import { extractSnippet } from "@/lib/pages/extractSnippet";
import { fetchFailureKind } from "@/lib/pages/fetchFailureKind";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import type { PageContent } from "@/lib/pages/types";

/**
 * Fetches a URL and reads its title, description, og:image, publication date,
 * links and body text. Never throws, and always reports `status` so a dead URL
 * can be told from a bot-blocked one.
 *
 * @param url - The URL. Unsafe URLs (see `isUnsafeUrl`) are never fetched.
 * @param opts - Options.
 * @param opts.timeoutMs - The read budget; 10 s by default.
 * @returns What was read. On failure, a host-based fallback title and why it failed.
 */
export async function fetchPageContent(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<PageContent> {
  let title = "Untitled Source";
  if (isUnsafeUrl(url)) {
    return { title, extractedText: null, status: null, failure: "network", publishedAt: null };
  }

  const out: Omit<PageContent, "title"> = {
    extractedText: null,
    status: null,
    publishedAt: null,
    podcastEpisode: null,
  };
  try {
    title = `Source from ${new URL(url).hostname.replace("www.", "")}`;
    const res = await fetch(url, {
      headers: { "User-Agent": BOT_USER_AGENT },
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS),
    });
    out.status = res.status;
    out.resolvedUrl = res.url || url;
    if (res.ok) {
      const html = await res.text();
      out.podcastEpisode = extractPodcastEpisodeIdentity(out.resolvedUrl, html);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) title = decodeEntities(titleMatch[1].trim());
      out.snippet = extractSnippet(html);
      out.ogImage = extractOgImage(html) ?? undefined;
      out.publishedAt = extractPublishedDate(html);
      out.links = extractArticleLinks(html, url);
      out.outboundLinks = extractOutboundLinks(html, url);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch?.[1]) {
        const text = extractReadableText(bodyMatch[1]);
        if (text.length > 50) {
          out.fullText = text;
          out.extractedText = text.slice(0, EXTRACT_MAX_CHARS);
        }
      }
    }
  } catch (e) {
    out.failure = fetchFailureKind(e);
  }
  return { title, ...out };
}

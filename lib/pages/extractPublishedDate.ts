import { DATE_META_KEYS } from "@/lib/pages/const";
import { escapeRegExp } from "@/lib/text/escapeRegExp";

/**
 * When the page says it was published. Deliberately conservative: a wrong date
 * is worse than none, since it would scope a claim to the wrong era. Meta tags
 * first, then JSON-LD `datePublished`, then any `<time datetime>` as a last
 * resort (it marks any date on the page, including a sidebar's).
 *
 * @param html - The page's HTML.
 * @param now - Today, for rejecting future dates.
 * @returns The date as YYYY-MM-DD, or null when nothing plausible (1995 to tomorrow) parses.
 */
export function extractPublishedDate(html: string, now: Date = new Date()): string | null {
  const candidates: string[] = [];
  for (const key of DATE_META_KEYS) {
    const k = escapeRegExp(key);
    const re = new RegExp(
      `<meta[^>]*(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']` +
        `|<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`,
      "i",
    );
    const m = html.match(re);
    if (m) candidates.push(m[1] ?? m[2]);
  }
  for (const block of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const m = block[1]?.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (m) candidates.push(m[1]);
  }
  const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeTag) candidates.push(timeTag[1]);

  for (const raw of candidates) {
    const parsed = new Date(raw.trim());
    if (isNaN(parsed.getTime())) continue;
    // Before the web, or a future template placeholder.
    if (parsed.getUTCFullYear() < 1995 || parsed.getTime() > now.getTime() + 86_400_000) continue;
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

import { OUTBOUND_LINK_CAP } from "@/lib/pages/const";

/**
 * Absolute http(s) links pointing off this host. An artist's own site states
 * their handles only in hrefs. Returning them is safe; acting on them is gated
 * at the call site, since a press article's footer links to the publication's
 * own socials.
 *
 * @param html - The page's HTML.
 * @param baseUrl - The page's URL.
 * @param max - The most links to return.
 * @returns The links, deduped, without fragments.
 */
export function extractOutboundLinks(
  html: string,
  baseUrl: string,
  max = OUTBOUND_LINK_CAP,
): string[] {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'\s>]+)["']/gi)) {
    const href = m[1];
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.origin === origin) continue;
      if (!/^https?:$/.test(abs.protocol)) continue;
      abs.hash = "";
      const clean = abs.toString();
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
      if (out.length >= max) break;
    } catch {
      // An unparseable href.
    }
  }
  return out;
}

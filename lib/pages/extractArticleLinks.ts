import { ARTICLE_LINK_CAP, NON_ARTICLE_PATH } from "@/lib/pages/const";

/**
 * Same-host links that plausibly point at articles, so an index page (a tag
 * archive, a category) can be followed to the coverage behind it. Same host
 * only: an index's off-site links are ads and social buttons.
 *
 * @param html - The page's HTML.
 * @param baseUrl - The page's URL.
 * @param max - The most links to return.
 * @returns Absolute, deduped links, without the page itself, section roots or listing paths.
 */
export function extractArticleLinks(
  html: string,
  baseUrl: string,
  max = ARTICLE_LINK_CAP,
): string[] {
  let origin: string;
  let basePath: string;
  try {
    const u = new URL(baseUrl);
    origin = u.origin;
    basePath = u.pathname.replace(/\/$/, "");
  } catch {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'\s>]+)["']/gi)) {
    let href = m[1];
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.origin !== origin) continue;
      abs.hash = "";
      href = abs.toString().replace(/\/$/, "");
      const path = abs.pathname.replace(/\/$/, "");
      if (!path || path === basePath) continue;
      // A bare section root ("/community") is another index, not a piece.
      if (path.split("/").filter(Boolean).length < 2 && !/\.html?$/i.test(path)) continue;
      if (NON_ARTICLE_PATH.test(path)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(href);
      if (out.length >= max) break;
    } catch {
      // An unparseable href.
    }
  }
  return out;
}

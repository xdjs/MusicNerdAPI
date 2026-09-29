import { DOMAIN_TYPE_MAP, PATH_KEYWORD_MAP } from "@/lib/sources/const";
import type { SourceType } from "@/lib/sources/types";

/**
 * A source's type from its URL: by domain, then by path keyword. Never
 * "website": a URL alone can't say whether a site is the artist's own.
 *
 * @param url - The URL.
 * @returns The type; "article" when nothing matches or the URL is malformed.
 */
export function inferTypeFromUrl(url: string): SourceType {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    for (const [domain, type] of Object.entries(DOMAIN_TYPE_MAP)) {
      if (host === domain || host.endsWith(`.${domain}`)) return type;
    }
    for (const part of parsed.pathname.toLowerCase().split("/")) {
      if (PATH_KEYWORD_MAP[part]) return PATH_KEYWORD_MAP[part];
    }
  } catch {
    // Malformed: fall through.
  }
  return "article";
}

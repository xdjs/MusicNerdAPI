import { AUTHORITY } from "@/lib/sources/const";
import { sourceAuthority } from "@/lib/sources/sourceAuthority";
import type { SourceTier } from "@/lib/sources/types";

/**
 * The tier the relevance judge is told about: a fact about the host, handed
 * over while it decides, so a thin page on a low-signal host has to prove
 * itself. The judge calls this with no type on purpose: whether a page is an
 * interview is a fact about the page, which the judge is reading.
 *
 * @param url - The page's URL.
 * @param type - The page's type, when known.
 * @param opts - Extra facts the caller knows.
 * @param opts.ownDomain - The URL is the artist's own site.
 * @returns "preferred", "unknown" or "low-signal".
 */
export function sourceTier(
  url: string,
  type?: string | null,
  opts?: { ownDomain?: boolean },
): SourceTier {
  const rank = sourceAuthority(url, type, opts);
  if (rank >= AUTHORITY.OWN_WORDS) return "preferred";
  if (rank <= AUTHORITY.AGGREGATOR) return "low-signal";
  return "unknown";
}

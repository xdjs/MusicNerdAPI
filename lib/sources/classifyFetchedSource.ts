import type { PageContent } from "@/lib/pages/types";
import { DEAD_PAGE_MARKERS, MIN_VERIFIED_TEXT } from "@/lib/sources/const";
import { nameAppearsIn } from "@/lib/sources/nameAppearsIn";
import type { SourceVerification } from "@/lib/sources/types";

/**
 * The gate: what a fetched candidate is worth. Fetching is the arbiter; a
 * claim may only cite a page we read. Status first, because it carries what the
 * body cannot: a 404 and a Cloudflare 403 both arrive with no usable text and
 * mean opposite things about whether the URL is real.
 *
 * @param page - What `fetchPageContent` read.
 * @param artistName - The artist's name.
 * @param opts - Options.
 * @param opts.requireFullName - The page came from a keyword search, so only the full name counts.
 * @param opts.identityConfirmed - The relevance judge already read the page and confirmed it; skip the name test.
 * @returns "verified", "lead" or "dead".
 */
export function classifyFetchedSource(
  page: PageContent,
  artistName: string,
  opts?: { requireFullName?: boolean; identityConfirmed?: boolean },
): SourceVerification {
  const { status, extractedText } = page;
  // Only a nonexistent hostname proves a bad URL; a timeout proves nothing.
  if (status === null) return page.failure === "dns" ? "dead" : "lead";
  if (status === 404 || status === 410) return "dead";
  // A real host that won't let us in (401/403/429) or broke (5xx).
  if (!(status >= 200 && status < 300)) return "lead";
  // Almost always a JS-rendered page: real, unread.
  if (!extractedText || extractedText.length < MIN_VERIFIED_TEXT) return "lead";

  // The full body, not the stored slice: an article naming the artist 6,000 characters in is still about them.
  const body = page.fullText ?? extractedText;
  const lower = body.toLowerCase();
  if (DEAD_PAGE_MARKERS.some(marker => lower.includes(marker))) return "dead";
  if (!opts?.identityConfirmed && !nameAppearsIn(body, artistName, opts)) return "lead";
  return "verified";
}

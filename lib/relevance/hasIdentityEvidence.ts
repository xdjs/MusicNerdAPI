import { identityAnchors } from "@/lib/relevance/identityAnchors";
import { relevanceExcerpt } from "@/lib/relevance/relevanceExcerpt";
import { escapeRegExp } from "@/lib/text/escapeRegExp";
import type { ArtistAnchor, RelevanceCandidate, RelevanceRow } from "@/lib/relevance/types";

/** Require a supplied distinguishing fact and a verbatim supporting passage actually sent. */
export function hasIdentityEvidence(
  row: RelevanceRow,
  page: RelevanceCandidate,
  anchor: ArtistAnchor,
): boolean {
  if (row.identity !== "match" || !Array.isArray(row.evidence)) return false;
  const anchors = identityAnchors(anchor);
  const excerpt = relevanceExcerpt(page.text ?? "", anchor)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return row.evidence.some(e => {
    if (!e || typeof e !== "object" || typeof e.quote !== "string") return false;
    const fact = anchors.find(a => a.id === e.anchor);
    if (!fact) return false;
    const quote = e.quote.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    if (quote.length < 20 || quote.length > 600 || !excerpt.includes(quote)) return false;
    const value = fact.value.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(value)}(?:$|[^\\p{L}\\p{N}])`, "u").test(
      quote,
    );
  });
}

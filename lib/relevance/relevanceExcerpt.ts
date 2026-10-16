import { EXCERPT_CHARS } from "@/lib/relevance/const";
import { identityAnchors } from "@/lib/relevance/identityAnchors";
import type { ArtistAnchor } from "@/lib/relevance/types";

/** Keep introductory context and surface a late anchor passage within the existing budget. */
export function relevanceExcerpt(text: string, anchor: ArtistAnchor): string {
  // Compare visible emphasis text; preserve underscores inside account names.
  text = text.replace(/(?<!\w)(\*{1,2}|_{1,2})(\S(?:.*?\S)?)\1(?!\w)/g, "$2");
  const initial = text.slice(0, EXCERPT_CHARS);
  const lower = text.toLowerCase();
  const positions = identityAnchors(anchor)
    .map(a => lower.indexOf(a.value.toLowerCase()))
    .filter(i => i >= 0);
  if (!positions.length || positions.some(i => i < EXCERPT_CHARS - 200)) return initial;
  const start = Math.max(750, Math.min(...positions) - 200);
  return `${text.slice(0, 750)}\n[…]\n${text.slice(start, start + EXCERPT_CHARS - 755)}`;
}

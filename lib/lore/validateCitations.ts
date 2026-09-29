import type { DocSource } from "@/lib/lore/types";

/**
 * Strips any `[n]` marker that doesn't resolve to a real source, so a
 * hallucinated citation never reaches the page. Also strips all-caps bracket
 * tokens the model cites as sources ("[VERIFIED CATALOG]") and our own
 * "(date unknown)" label when the model copies it into the text.
 *
 * @param text - The model's document.
 * @param sources - The numbered manifest it was given.
 * @returns The text with valid markers left exactly as written.
 */
export function validateCitations(text: string, sources: DocSource[]): string {
  const validIds = new Set(sources.map(s => s.id));
  return text
    .replace(/\[(\d+)\]/g, (full, idStr) => (validIds.has(Number(idStr)) ? full : ""))
    .replace(/\s*\[[A-Z][A-Z \-_]{2,}\]/g, "")
    .replace(/\s*\((?:date unknown|year unknown|no date)\)/gi, "");
}

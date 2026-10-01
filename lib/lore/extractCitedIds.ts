/**
 * Every `[n]` marker id in a text, so a caller can tell which of the numbered
 * sources the document and the About actually cite.
 *
 * @param text - Cited text.
 * @returns The ids.
 */
export function extractCitedIds(text: string): Set<number> {
  const ids = new Set<number>();
  for (const m of text.matchAll(/\[(\d+)\]/g)) ids.add(Number(m[1]));
  return ids;
}

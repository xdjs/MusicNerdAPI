/** Resolve a quotation to original offsets, permitting layout-only whitespace differences.
 * @param text - Original extracted text.
 * @param quote - Continuous quotation; no ellipses, substitutions or paraphrases allowed.
 * @returns The exact original span, or null when words do not match.
 */
export function locateInterviewQuote(
  text: string,
  quote: string,
): { start: number; end: number } | null {
  if (quote.trim().length < 12) return null;
  const pattern = quote
    .trim()
    .split(/\s+/)
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = new RegExp(pattern, "u").exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

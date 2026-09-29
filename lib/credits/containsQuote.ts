/**
 * Whitespace- and case-insensitive containment. Models reflow line breaks when
 * quoting, and an otherwise verbatim quote should not fail over a newline.
 * Everything else must match exactly.
 *
 * @param haystack - The caption.
 * @param needle - The quote.
 * @returns True when the quote is in the caption.
 */
export function containsQuote(haystack: string, needle: string): boolean {
  const h = haystack.replace(/\s+/g, " ").trim().toLowerCase();
  const n = needle.replace(/\s+/g, " ").trim().toLowerCase();
  return n.length > 0 && h.includes(n);
}

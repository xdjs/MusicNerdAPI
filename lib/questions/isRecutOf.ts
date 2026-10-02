/**
 * Is one quote a re-cut of the other? The extractor re-topics one sentence
 * several ways and its copies differ only in where they stop. The 40-character
 * floor keeps two different short statements that open alike apart.
 *
 * @param a - A folded quote.
 * @param b - Another folded quote.
 * @returns True when either starts with the other and both are long enough.
 */
export function isRecutOf(a: string, b: string): boolean {
  return Math.min(a.length, b.length) >= 40 && (a.startsWith(b) || b.startsWith(a));
}

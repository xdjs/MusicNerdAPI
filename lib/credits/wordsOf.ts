/**
 * The words of a text, lowercased: runs of letters and digits.
 *
 * @param text - Any text.
 * @returns Its words.
 */
export function wordsOf(text: string): string[] {
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

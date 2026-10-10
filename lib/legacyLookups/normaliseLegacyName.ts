/**
 * A name as MusicNerdWeb's artist search normalises it: accents removed,
 * punctuation dropped (letters, numbers and spaces kept, in any script),
 * lowercased. Unlike `foldForMatch`, punctuation vanishes rather than
 * becoming a space, so "AC/DC" is "acdc"; matching `lcname` depends on that.
 *
 * @param input - Any name.
 * @returns The normalised name.
 */
export function normaliseLegacyName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .toLowerCase();
}

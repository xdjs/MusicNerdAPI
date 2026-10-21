/**
 * The same fold as `foldTrackText`, single-spaced: keeps the word boundaries
 * that folding destroys, for comparing credited names.
 *
 * @param s - A title or name.
 * @returns The normalised form.
 */
export function normTrackText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Letters and digits of ANY script, run together: the form two titles are
 * compared in. `[^a-z0-9]` reduced a Korean or Japanese title to the empty
 * string, so every non-Latin release by one artist compared equal.
 *
 * @param s - A title or name.
 * @returns The folded form.
 */
export function foldTrackText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

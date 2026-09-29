/**
 * Does the artist's row hold a real answer for this platform, or a placeholder?
 * The onboarding auto-build writes handles built from the artist's name; the
 * caller names those columns as provisional so a corroborated answer can
 * replace them. First writer wins otherwise, and it has the least evidence.
 *
 * @param artist - The artist row snapshot.
 * @param siteName - The platform column.
 * @param provisional - Columns holding a guess.
 * @returns True when the column is set and not provisional.
 */
export function holdsAnswerFor(
  artist: Record<string, unknown>,
  siteName: string,
  provisional?: Set<string>,
): boolean {
  return !!artist[siteName] && !provisional?.has(siteName);
}

import type { ArtistStatement } from "@/lib/credits/types";

/**
 * How worth asking about a statement is: naming somebody first (a decision only
 * the artist can explain), then substance, bucketed so long captions can't
 * crowd out interesting ones.
 *
 * @param s - A statement.
 * @returns 3 for naming an @handle, plus 1 over 120 characters or 2 over 300.
 */
export function statementScore(s: ArtistStatement): number {
  const quote = s.quote ?? "";
  const names = /@[A-Za-z0-9._]{3,}/.test(quote) ? 3 : 0;
  const substance = quote.length > 300 ? 2 : quote.length > 120 ? 1 : 0;
  return names + substance;
}

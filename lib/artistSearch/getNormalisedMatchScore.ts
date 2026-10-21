import { normaliseArtistName } from "@/lib/artistLookups/normaliseArtistName";

/**
 * `getMatchScore` on normalised names (accents and punctuation removed), as
 * MusicNerdWeb's batch search scored it.
 *
 * @param name - The artist's name.
 * @param query - What was searched for.
 * @returns The tier: 0 exact, 1 starts with, 2 contains, 3 neither.
 */
export function getNormalisedMatchScore(name: string, query: string): number {
  const nameNorm = normaliseArtistName(name);
  const queryNorm = normaliseArtistName(query);
  if (nameNorm === queryNorm) return 0;
  if (nameNorm.startsWith(queryNorm)) return 1;
  if (nameNorm.includes(queryNorm)) return 2;
  return 3;
}

/**
 * How well a name matches the query, for sorting: 0 exact, 1 starts with,
 * 2 contains, 3 neither (similarity only). Lowercased, nothing else, as
 * MusicNerdWeb's `searchArtists` scored it.
 *
 * @param name - The artist's name.
 * @param query - What was searched for.
 * @returns The tier.
 */
export function getMatchScore(name: string, query: string): number {
  const nameLower = name.toLowerCase();
  const queryLower = query.toLowerCase();
  if (nameLower === queryLower) return 0;
  if (nameLower.startsWith(queryLower)) return 1;
  if (nameLower.includes(queryLower)) return 2;
  return 3;
}

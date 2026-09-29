/**
 * The searches a source search runs. Exact phrases, because an unquoted name
 * matches each word on its own ("Black Dave" returns Dave the UK rapper). Then
 * the bare name, the way a person types it, which finds the artist's own pages
 * that never contain the exact phrase. Then a credits lookup, since no
 * editorial query returns a credits database, where a producer's work is.
 *
 * @param artistName - The artist's name.
 * @returns Five queries.
 */
export function sourceSearchQueries(artistName: string): string[] {
  return [
    `"${artistName}" music artist interview`,
    `"${artistName}" music review`,
    `"${artistName}" artist profile`,
    artistName,
    `"${artistName}" discogs credits`,
  ];
}

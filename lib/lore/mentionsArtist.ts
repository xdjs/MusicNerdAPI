/**
 * Whether a paragraph talks about the artist: their full name, or any word of
 * it four letters or longer.
 *
 * @param paragraph - A paragraph of source text.
 * @param artistName - The artist's name.
 * @returns True when the paragraph names them.
 */
export function mentionsArtist(paragraph: string, artistName: string): boolean {
  const low = paragraph.toLowerCase();
  const tokens = artistName
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 4);
  return low.includes(artistName.toLowerCase()) || tokens.some(t => low.includes(t));
}

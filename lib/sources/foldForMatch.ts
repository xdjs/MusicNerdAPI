/**
 * Text folded for a name match: lowercase, no diacritics, every run of
 * non-alphanumerics one space. Unlike `foldName`, word breaks survive, so
 * "Pete Rango" matches "PETE-RANGO" as two words.
 *
 * @param text - Any text.
 * @returns The folded text.
 */
export function foldForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Removes every `[n]` and grouped `[n, m]` marker, valid or not, for text that
 * must never carry them: the published About (`artists.bio`, which also feeds
 * the page's meta description) and its history. The Lore keeps its markers.
 * Spaces before a marker go with it; newlines never do.
 *
 * @param text - Text that may carry citation markers.
 * @returns The plain prose.
 */
export function stripCitationMarkers(text: string): string {
  return text
    .replace(/[ \t]*\[\d+(?:\s*,\s*\d+)*\]/g, "")
    .replace(/[ \t]+([.,;:!?)\]])/g, "$1")
    .replace(/(^|\n)[ \t]+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

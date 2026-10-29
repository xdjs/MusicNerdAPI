/**
 * An artist name for comparing across platforms: accents and punctuation
 * dropped, lowercased, a leading "the" and a trailing "feat. …" removed.
 *
 * @param name - The name.
 * @returns The comparable form, possibly empty.
 */
export function normalizeCatalogArtistName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "")
    .replace(/\s+(?:feat|ft|featuring)\s+.*/, "")
    .trim();
}

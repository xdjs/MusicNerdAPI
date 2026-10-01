/**
 * A name for exact matching: trimmed, lowercased, whitespace collapsed. Word
 * breaks are kept, unlike `foldName`: "Pete Rango" must not match "PeteRango".
 *
 * @param name - An artist name.
 * @returns The normalized name.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

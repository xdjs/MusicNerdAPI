/**
 * A card's name when urlmap has no row for the column: the column, capitalized.
 *
 * @param siteName - The column.
 * @returns The display name.
 */
export function fallbackDisplayName(siteName: string): string {
  return siteName.charAt(0).toUpperCase() + siteName.slice(1);
}

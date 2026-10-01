import { artistRowProperty } from "@/lib/artists/artistRowProperty";

/**
 * Does the artist already have a value in this column? A plain non-empty
 * check on the raw column, not the display rules, which hide some values and
 * would let a proposed candidate overwrite a set column.
 *
 * @param artist - The artist row.
 * @param siteName - The column.
 * @returns True for a non-empty string.
 */
export function artistHasRawLinkValue(artist: Record<string, unknown>, siteName: string): boolean {
  const value = artist[artistRowProperty(siteName)];
  return typeof value === "string" && value.length > 0;
}

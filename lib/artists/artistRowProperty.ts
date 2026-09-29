import { ARTIST_ROW_PROPERTY_BY_COLUMN } from "@/lib/artists/const";

/**
 * The row property to read for a column: `facebookID` is read as `facebookId`.
 *
 * @param column - A physical column name.
 * @returns The Drizzle row property, usually the column itself.
 */
export function artistRowProperty(column: string): string {
  return ARTIST_ROW_PROPERTY_BY_COLUMN[column] ?? column;
}

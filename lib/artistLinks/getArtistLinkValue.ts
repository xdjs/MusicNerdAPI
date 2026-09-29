import { artistRowProperty } from "@/lib/artists/artistRowProperty";

/**
 * The value an artist row holds for a link column.
 *
 * @param artist - The artist row.
 * @param columnName - The physical column name.
 * @returns The value, or null when unset.
 */
export function getArtistLinkValue(artist: object, columnName: string): string | null {
  return (
    ((artist as Record<string, unknown>)[artistRowProperty(columnName)] as
      string | null | undefined) ?? null
  );
}

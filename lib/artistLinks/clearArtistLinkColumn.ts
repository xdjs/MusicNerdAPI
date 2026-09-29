import { eq, sql } from "drizzle-orm";
import { getArtistLinkValue } from "@/lib/artistLinks/getArtistLinkValue";
import type { ArtistLinkExecutor } from "@/lib/artistLinks/types";
import { artists } from "@/lib/db/schema";

/**
 * Nulls one link column on an artist's row. The caller has already checked
 * the column is a writable link and taken the locks.
 *
 * @param database - The transaction or client.
 * @param artistId - The artist.
 * @param columnName - A whitelisted link column.
 * @returns The value it held. Throws when the artist doesn't exist.
 */
export async function clearArtistLinkColumn(
  database: ArtistLinkExecutor,
  artistId: string,
  columnName: string,
): Promise<{ oldValue: string | null }> {
  const artist = await database.query.artists.findFirst({ where: eq(artists.id, artistId) });
  if (!artist) throw new Error(`Artist not found: ${artistId}`);
  const oldValue = getArtistLinkValue(artist, columnName);
  await database.execute(
    sql`UPDATE artists SET ${sql.identifier(columnName)} = NULL WHERE id = ${artistId}`,
  );
  return { oldValue };
}

import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/db";
import { legacyArtists, type LegacyArtist } from "@/lib/legacyLookups/legacyArtists";

/**
 * The first artist whose column equals the value exactly, as MusicNerdWeb's
 * `getArtistByProperty` matched it.
 *
 * @param column - A `legacyArtists` column.
 * @param value - The value to match, case-sensitively.
 * @returns The whole row, or undefined; throws on a database error.
 */
export async function findLegacyArtist(
  column: PgColumn,
  value: string,
): Promise<LegacyArtist | undefined> {
  const rows = await db.select().from(legacyArtists).where(eq(column, value)).limit(1);
  return rows[0];
}

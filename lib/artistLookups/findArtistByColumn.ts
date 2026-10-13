import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/db";
import { lookupArtists, type LookupArtist } from "@/lib/artistLookups/lookupArtists";

/**
 * The first artist whose column equals the value exactly, as MusicNerdWeb's
 * `getArtistByProperty` matched it.
 *
 * @param column - A `lookupArtists` column.
 * @param value - The value to match, case-sensitively.
 * @returns The whole row, or undefined; throws on a database error.
 */
export async function findArtistByColumn(
  column: PgColumn,
  value: string,
): Promise<LookupArtist | undefined> {
  const rows = await db.select().from(lookupArtists).where(eq(column, value)).limit(1);
  return rows[0];
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Finds a unique artist by display name, ignoring only case and outer spaces.
 * Count matches before inspecting X: a missing handle never permits fallback
 * to a namesake or similar artist. Two rows are enough to detect ambiguity.
 *
 * @param name - The artist name supplied by the caller.
 * @returns The unique artist's stored X value, or undefined for no/ambiguous match.
 */
export async function findArtistByExactName(
  name: string,
): Promise<{ x: string | null } | undefined> {
  if (!name.trim()) return undefined;
  const rows = await db.execute<{ x: string | null }>(sql`
    SELECT x
    FROM artists
    WHERE lower(btrim(name)) = lower(btrim(${name}))
    LIMIT 2
  `);
  return rows.length === 1 ? rows[0] : undefined;
}

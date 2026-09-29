import { sql } from "drizzle-orm";
import type { db } from "@/lib/db/db";

/**
 * Locks the artist's row for the rest of the caller's transaction. Every
 * claim-checked write takes this lock, and so does claim revocation, so a
 * write either commits before a revocation or sees it.
 *
 * @param tx - The open transaction.
 * @param artistId - The artist.
 * @returns Nothing; resolves once the lock is held.
 */
export async function lockArtistRow(
  tx: Pick<typeof db, "execute">,
  artistId: string,
): Promise<void> {
  await tx.execute(sql`select id from artists where id = ${artistId}::uuid for update`);
}

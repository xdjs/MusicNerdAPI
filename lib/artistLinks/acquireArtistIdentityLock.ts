import { sql } from "drizzle-orm";
import type { ArtistIdentityLockExecutor } from "@/lib/artistLinks/types";

/**
 * A transaction-scoped advisory lock on a key; Postgres releases it when the
 * transaction ends.
 *
 * @param database - The protected write's transaction.
 * @param key - The lock key.
 * @returns Once the lock is held.
 */
export async function acquireArtistIdentityLock(
  database: ArtistIdentityLockExecutor,
  key: string,
): Promise<void> {
  await database.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

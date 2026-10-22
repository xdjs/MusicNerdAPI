import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";

/**
 * How many user-submitted links await admin review: MusicNerdWeb's
 * `getPendingUGC` predicate (`accepted = false and date_processed is null`),
 * counted in the database instead of loading every row.
 *
 * @returns The count.
 */
export async function countPendingUGC(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(ugcresearch)
    .where(and(eq(ugcresearch.accepted, false), isNull(ugcresearch.dateProcessed)));
  return row?.count ?? 0;
}

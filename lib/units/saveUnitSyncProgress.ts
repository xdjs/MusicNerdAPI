import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Record a `unit_sync` slice's progress and hand the lease back, as `saveJobProgress` does, but keep
 * a `rescan` that `queueUnitSync` set while the slice ran: the slice's own state replaces the rest.
 *
 * @param jobId - The job.
 * @param cursor - Where the next slice starts, for display.
 * @param total - The number of sources this slice listed.
 * @param state - The job's new state; it must not carry `rescan`.
 * @returns Nothing; a database error is logged by name, not thrown.
 */
export async function saveUnitSyncProgress(
  jobId: string,
  cursor: number,
  total: number,
  state: Record<string, unknown>,
): Promise<void> {
  try {
    await db.execute(sql`
      update artist_research_jobs
         set cursor = ${cursor}, total = ${total}, status = 'pending', claimed_at = null, attempts = 0,
             state = ${JSON.stringify(state)}::jsonb
                     || case when state->'rescan' = 'true'::jsonb then '{"rescan":true}'::jsonb else '{}'::jsonb end,
             updated_at = now()
       where id = ${jobId}::uuid`);
  } catch (error) {
    // The name only: a failed query's message carries its bound parameters.
    console.warn(
      `[unit_sync] Could not save job ${jobId}: ${error instanceof Error ? error.name : "unknown"}`,
    );
  }
}

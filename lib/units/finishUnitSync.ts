import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * Finish a `unit_sync` job that reached the end of its source list, unless a rescan was asked for
 * meanwhile (`queueUnitSync` on a live job). The check and the write are one statement, so a rescan
 * that lands while the slice runs is never lost.
 *
 * @param jobId - The job.
 * @param state - The job's final state; it must not carry `rescan`.
 * @returns True when the job is done; false when a rescan was pending: the flag is cleared, the
 * state written, and the claim kept, so the caller starts over from the top. A database error is
 * logged by name and reported as done, as `completeResearchJob` does.
 */
export async function finishUnitSync(
  jobId: string,
  state: Record<string, unknown>,
): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      update artist_research_jobs
         set status = case when state->'rescan' = 'true'::jsonb then status else 'done' end,
             claimed_at = case when state->'rescan' = 'true'::jsonb then now() end,
             last_error = null,
             state = ${JSON.stringify(state)}::jsonb,
             updated_at = now()
       where id = ${jobId}::uuid
       returning status = 'done' as done`);
    const [row] = rowsOf(result) as { done?: boolean }[];
    return row?.done !== false;
  } catch (error) {
    // The name only: a failed query's message carries its bound parameters.
    console.warn(
      `[unit_sync] Could not finish job ${jobId}: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return true;
  }
}

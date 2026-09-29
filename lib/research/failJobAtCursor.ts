import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { MAX_ATTEMPTS } from "@/lib/research/const";

/**
 * Records a failed attempt and where the job got to, in one statement.
 * `saveJobProgress` resets attempts to zero, so saving progress and then
 * failing left every retry at one attempt and the job could never give up.
 *
 * @param jobId - The job.
 * @param cursor - Where the next attempt starts.
 * @param total - The total, when known.
 * @param state - The job's state to keep.
 * @param error - What went wrong, truncated to 500 characters.
 * @returns Nothing; a database error is logged, not thrown.
 */
export async function failJobAtCursor(
  jobId: string,
  cursor: number,
  total: number | null,
  state: Record<string, unknown>,
  error: string,
): Promise<void> {
  try {
    await db.execute(sql`
      update artist_research_jobs
         set cursor = ${cursor}, total = coalesce(${total ?? null}, total),
             state = ${JSON.stringify(state)}::jsonb,
             attempts = attempts + 1,
             status = case when attempts + 1 >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end,
             claimed_at = null, last_error = ${error.slice(0, 500)}, updated_at = now()
       where id = ${jobId}::uuid`);
  } catch (e) {
    console.error("[failJobAtCursor] Error:", e);
  }
}

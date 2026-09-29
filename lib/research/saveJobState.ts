import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Writes job state while KEEPING the claim, for the middle of a slice.
 * Releasing it mid-slice would let another invocation take the same job.
 *
 * @param jobId - The job.
 * @param state - The job's new state.
 * @returns Nothing; a database error is logged, not thrown.
 */
export async function saveJobState(jobId: string, state: Record<string, unknown>): Promise<void> {
  try {
    await db.execute(sql`
      update artist_research_jobs
         set state = ${JSON.stringify(state)}::jsonb, claimed_at = now(), updated_at = now()
       where id = ${jobId}::uuid`);
  } catch (e) {
    console.error("[saveJobState] Error:", e);
  }
}

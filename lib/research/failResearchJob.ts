import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { MAX_ATTEMPTS } from "@/lib/research/const";

/**
 * Records a failed attempt. The job stays pending until attempts run out,
 * then fails; either way the error is on the row.
 *
 * @param jobId - The job.
 * @param error - What went wrong, truncated to 500 characters.
 * @returns Nothing; a database error is logged, not thrown.
 */
export async function failResearchJob(jobId: string, error: string): Promise<void> {
  try {
    await db.execute(sql`
      update artist_research_jobs
         set attempts = attempts + 1,
             status = case when attempts + 1 >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end,
             claimed_at = null, last_error = ${error.slice(0, 500)}, updated_at = now()
       where id = ${jobId}::uuid`);
  } catch (e) {
    console.error("[failResearchJob] Error:", e);
  }
}

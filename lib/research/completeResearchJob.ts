import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Marks a job finished. The row stays: "this ran and found nothing" is a fact worth keeping.
 *
 * @param jobId - The job.
 * @returns Nothing; a database error is logged, not thrown.
 */
export async function completeResearchJob(jobId: string): Promise<void> {
  try {
    await db.execute(sql`
      update artist_research_jobs
         set status = 'done', claimed_at = null, last_error = null, updated_at = now()
       where id = ${jobId}::uuid`);
  } catch (e) {
    console.error("[completeResearchJob] Error:", e);
  }
}

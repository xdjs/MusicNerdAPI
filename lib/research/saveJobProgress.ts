import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Records progress and hands the lease back, so the next slice can start at
 * once. Progress is also proof of life, so it clears the failure count.
 *
 * @param jobId - The job.
 * @param cursor - Where the next slice starts.
 * @param opts - Optional total and replacement state.
 * @param opts.total - The total, when now known.
 * @param opts.state - The job's new state.
 * @returns Nothing; a database error is logged, not thrown.
 */
export async function saveJobProgress(
  jobId: string,
  cursor: number,
  opts?: { total?: number | null; state?: Record<string, unknown> },
): Promise<void> {
  try {
    await db.execute(sql`
      update artist_research_jobs
         set cursor = ${cursor}, status = 'pending', claimed_at = null, attempts = 0,
             total = coalesce(${opts?.total ?? null}, total),
             state = coalesce(${opts?.state ? JSON.stringify(opts.state) : null}::jsonb, state),
             updated_at = now()
       where id = ${jobId}::uuid`);
  } catch (e) {
    console.error("[saveJobProgress] Error:", e);
  }
}

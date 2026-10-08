import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * Hands a finished lore_refresh back: done, unless a newer request arrived
 * while it rebuilt (its `requestedAt` changed), in which case it goes back to
 * pending so the rebuild runs again against the newer sources.
 *
 * @param jobId - The job.
 * @param requestedAt - The job's `requestedAt` when this slice claimed it, or "".
 * @returns True when the job is done (or gone); false when it was re-queued.
 */
export async function settleLoreRefresh(jobId: string, requestedAt: string): Promise<boolean> {
  const rows = await db.execute(sql`
    update artist_research_jobs
       set status = case when coalesce(state->>'requestedAt', '') = ${requestedAt} then 'done' else 'pending' end,
           claimed_at = null, last_error = null, updated_at = now()
     where id = ${jobId}::uuid
    returning status`);
  const status = (rowsOf(rows)[0] as { status?: string } | undefined)?.status;
  return status === undefined || status === "done";
}

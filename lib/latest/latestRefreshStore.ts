import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { LatestRefreshState } from "@/lib/latest/types";
import type { ResearchJob } from "@/lib/research/types";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";

/**
 * Saves a Latest check's state under the job's guard. Strict: the intent to
 * start a paid Apify run must never be lost to a swallowed database error.
 *
 * @param job - The running `latest_refresh` job.
 * @param state - The state to save.
 * @param done - Omitted: still running (lease renewed). True: done. False: back to pending for the next slice.
 * @returns Nothing; throws when the job is no longer running.
 */
export async function latestRefreshStore(
  job: ResearchJob,
  state: LatestRefreshState,
  done?: boolean,
): Promise<void> {
  await withResearchJobWrite(job.artistId, job.id, async tx => {
    const status = done === undefined ? "running" : done ? "done" : "pending";
    const rows = await tx.execute(sql`update artist_research_jobs
      set state = ${JSON.stringify(state)}::jsonb, status = ${status},
          claimed_at = ${done === undefined ? sql`now()` : sql`null`}, updated_at = now()
      where id = ${job.id}::uuid and kind = 'latest_refresh' and status = 'running' returning id`);
    if (!rowsOf(rows).length) throw new Error("Latest refresh no longer active");
  });
}

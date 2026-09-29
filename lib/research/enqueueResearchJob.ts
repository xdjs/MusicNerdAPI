import { sql } from "drizzle-orm";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { JobKind } from "@/lib/research/types";

/**
 * Queues the next job for an artist, from inside the job that finished. A
 * live job for the same artist and kind makes this a no-op (the unique
 * partial index enforces it), and the parent's guard stops a revoked job
 * from queueing more work. The child keeps the parent's activity, so the
 * work stays attributed to whoever started it.
 *
 * @param artistId - The artist.
 * @param kind - The kind of job to queue.
 * @param opts - The parent job and the new job's starting state.
 * @param opts.parentJobId - The job queueing this one.
 * @param opts.state - The new job's state.
 * @returns True when a job is live afterwards, whether or not this call made it.
 */
export async function enqueueResearchJob(
  artistId: string,
  kind: JobKind,
  opts: { parentJobId: string; state?: Record<string, unknown> },
): Promise<boolean> {
  try {
    await withResearchJobWrite(artistId, opts.parentJobId, async tx => {
      await tx.execute(sql`
        insert into artist_research_jobs (artist_id, kind, total, state, activity_id)
        values (${artistId}::uuid, ${kind}, ${null}, ${JSON.stringify(opts.state ?? {})}::jsonb,
          (select activity_id from artist_research_jobs where id = ${opts.parentJobId}::uuid and artist_id = ${artistId}::uuid))
        on conflict do nothing`);
    });
    return true;
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw e;
    console.error("[enqueueResearchJob] Error:", e);
    return false;
  }
}

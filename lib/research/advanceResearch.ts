import { claimResearchJob } from "@/lib/research/claimResearchJob";
import { PERSIST_RESERVE_MS, PORTED_JOB_KINDS } from "@/lib/research/const";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { runIngest } from "@/lib/research/runIngest";
import type { AdvanceResult } from "@/lib/research/types";

/**
 * Claims one job this API can run and works on it for up to `budgetMs`.
 * Everything the slice learns is on the job row before it returns, so being
 * killed costs the current slice and nothing else.
 *
 * @param opts - The slice's budget and scope.
 * @param opts.budgetMs - How long the slice may run.
 * @param opts.artistId - Only this artist's jobs.
 * @param opts.excludeJobIds - Jobs already set aside this tick.
 * @returns What ran, or `{ ran: false }` when there was nothing to do.
 */
export async function advanceResearch(opts: {
  budgetMs: number;
  artistId?: string;
  excludeJobIds?: string[];
}): Promise<AdvanceResult> {
  const job = await claimResearchJob({
    kinds: PORTED_JOB_KINDS,
    artistId: opts.artistId,
    excludeIds: opts.excludeJobIds,
  });
  if (!job) return { ran: false };

  const about = { ran: true, jobId: job.id, kind: job.kind, artistId: job.artistId };
  const deadline = Date.now() + Math.max(0, opts.budgetMs - PERSIST_RESERVE_MS);
  try {
    return { ...about, ...(await runIngest(job, deadline)) };
  } catch (e) {
    if (e instanceof OwnershipChangedError) {
      return { ...about, done: true, progress: "Research cancelled after ownership changed" };
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[research] ${job.kind} failed for ${job.artistId}:`, message);
    await failResearchJob(job.id, message);
    return { ...about, progress: `failed: ${message}` };
  }
}

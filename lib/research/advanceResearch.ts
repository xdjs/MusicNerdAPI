import { claimResearchJob } from "@/lib/research/claimResearchJob";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { PERSIST_RESERVE_MS, PORTED_JOB_KINDS } from "@/lib/research/const";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { runResearchJob } from "@/lib/research/runResearchJob";
import type { AdvanceResult, JobKind } from "@/lib/research/types";

/**
 * Claims one job this API can run and works on it for up to `budgetMs`.
 * Everything the slice learns is on the job row before it returns, so being
 * killed costs the current slice and nothing else.
 *
 * @param opts - The slice's budget and scope.
 * @param opts.budgetMs - How long the slice may run.
 * @param opts.artistId - Only this artist's jobs.
 * @param opts.excludeJobIds - Jobs already set aside this tick.
 * @param opts.kinds - Only these kinds (a subset of the ported ones); all ported kinds when omitted.
 * @returns What ran, or `{ ran: false }` when there was nothing to do.
 */
export async function advanceResearch(opts: {
  budgetMs: number;
  artistId?: string;
  excludeJobIds?: string[];
  kinds?: JobKind[];
}): Promise<AdvanceResult> {
  const job = await claimResearchJob({
    kinds: opts.kinds ?? PORTED_JOB_KINDS,
    artistId: opts.artistId,
    excludeIds: opts.excludeJobIds,
  });
  if (!job) return { ran: false };

  const about = { ran: true, jobId: job.id, kind: job.kind, artistId: job.artistId };
  const deadline = Date.now() + Math.max(0, opts.budgetMs - PERSIST_RESERVE_MS);
  try {
    return { ...about, ...(await runResearchJob(job, deadline)) };
  } catch (e) {
    if (e instanceof OwnershipChangedError) {
      // Cancellation is terminal. Left running, the row is reclaimed after
      // every lease expiry and blocks replacement work of its kind.
      await completeResearchJob(job.id);
      return { ...about, done: true, progress: "Research cancelled after ownership changed" };
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[research] ${job.kind} failed for ${job.artistId}:`, message);
    await failResearchJob(job.id, message);
    return { ...about, progress: `failed: ${message}` };
  }
}

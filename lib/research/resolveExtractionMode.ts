import { claimedSourceUrls } from "@/lib/credits/claimedSourceUrls";
import { clearSocialCredits } from "@/lib/credits/clearSocialCredits";
import { saveJobState } from "@/lib/research/saveJobState";
import type { ResearchJob } from "@/lib/research/types";

/**
 * Whether this caption job reads incrementally, decided ONCE on the first
 * slice and written on the job. Asking "are there credits?" every slice flipped
 * the answer after the first slice stored anything, while the cursor still
 * indexed the longer list, and the job skipped most of the feed.
 *
 * Only an explicit full re-read (or an artist with no credits) clears, and only
 * before anything is read. A "look again" reads only captions it has no credit for.
 *
 * @param job - The claimed job; its `state.mode` is set on the first slice.
 * @returns True when the job reads incrementally.
 */
export async function resolveExtractionMode(job: ResearchJob): Promise<boolean> {
  if (job.cursor !== 0 || job.state?.mode !== undefined) return job.state?.mode === "incremental";
  const existing = await claimedSourceUrls(job.artistId);
  const incremental =
    job.state?.incremental === true || (job.state?.fullRebuild !== true && existing.size > 0);
  job.state = { ...job.state, mode: incremental ? "incremental" : "full" };
  await saveJobState(job.id, job.state);
  if (!incremental) await clearSocialCredits(job.artistId, job.id);
  return incremental;
}

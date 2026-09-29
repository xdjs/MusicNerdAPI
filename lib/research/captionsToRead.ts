import { claimedSourceUrls } from "@/lib/credits/claimedSourceUrls";
import type { SocialPostRow } from "@/lib/instagram/types";
import { saveJobState } from "@/lib/research/saveJobState";
import type { ResearchJob } from "@/lib/research/types";

/**
 * The list this caption job works through. For an incremental job, that is the
 * captions it had no credit for AT THE START: the baseline is written on the
 * first slice so later slices filter by the same set, not by one this job has
 * been adding to. A saved cursor only means something against a stable list.
 *
 * @param job - The claimed job; its `state.baseline` is set on the first incremental slice.
 * @param posts - The artist's stored posts.
 * @param incremental - Whether the job reads incrementally.
 * @returns The posts to read.
 */
export async function captionsToRead(
  job: ResearchJob,
  posts: SocialPostRow[],
  incremental: boolean,
): Promise<SocialPostRow[]> {
  if (!incremental) return posts;
  if (Array.isArray(job.state?.baseline)) {
    const baseline = new Set(job.state.baseline as string[]);
    return posts.filter(p => !baseline.has(p.url));
  }
  const existing = await claimedSourceUrls(job.artistId);
  job.state = { ...job.state, baseline: [...existing] };
  await saveJobState(job.id, job.state);
  return posts.filter(p => !existing.has(p.url));
}

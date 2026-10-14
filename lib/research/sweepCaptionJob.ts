import { assertSocialJobActive } from "@/lib/research/assertSocialJobActive";
import { appendSocialCredits } from "@/lib/credits/appendSocialCredits";
import { claimedSourceUrls } from "@/lib/credits/claimedSourceUrls";
import { SWEEP_RESERVE_MS } from "@/lib/credits/const";
import { sweepSilentCaptions } from "@/lib/credits/sweepSilentCaptions";
import type { ExtractionSlice } from "@/lib/credits/types";
import type { SocialPostRow } from "@/lib/instagram/types";
import { failSocialJob } from "@/lib/research/failSocialJob";
import { saveSocialJobProgress } from "@/lib/research/saveSocialJobProgress";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * The second look at silent captions, once every batch is read. It is still
 * work: a job that completed before sweeping lost the sweep on exactly the
 * slow final slices where it mattered. It can take more than one slice, so its
 * cursor is carried on the job.
 *
 * @param job - The claimed job; its state gains `swept` or `sweepCursor`.
 * @param toRead - The posts this job works through.
 * @param artist - The artist's name and handle.
 * @param artist.name - Their name.
 * @param artist.instagram - Their handle.
 * @param postedAtByUrl - Each post's date, stored with its credits.
 * @param read - The slice that finished the batches.
 * @param deadline - When this slice must stop.
 * @returns The slice's outcome while the sweep is unfinished or failed; null once swept.
 */
export async function sweepCaptionJob(
  job: ResearchJob,
  toRead: SocialPostRow[],
  artist: { name: string; instagram: string | null },
  postedAtByUrl: Map<string, string | null>,
  read: ExtractionSlice,
  deadline: number,
): Promise<SliceOutcome | null> {
  if (job.state?.swept === true) return null;
  const progress = { total: read.totalBatches, state: job.state };
  if (deadline - Date.now() < SWEEP_RESERVE_MS) {
    await saveSocialJobProgress(job, read.nextBatch, progress);
    return { progress: "batches done, sweep deferred to the next slice", done: false };
  }
  const sweepStart = typeof job.state?.sweepCursor === "number" ? job.state.sweepCursor : 0;
  const swept = await sweepSilentCaptions(
    toRead,
    await claimedSourceUrls(job.artistId),
    artist.name,
    artist.instagram ?? "",
    {
      budgetMs: deadline - Date.now(),
      startBatch: sweepStart,
      beforeBatch: () => assertSocialJobActive(job),
    },
  );
  if ((await appendSocialCredits(job.artistId, swept.extraction, postedAtByUrl, job.id)) === null) {
    await failSocialJob(job, "could not store swept credits");
    return { progress: "sweep storage failed", done: false };
  }
  job.state = swept.done
    ? { ...job.state, swept: true }
    : { ...job.state, sweepCursor: swept.nextBatch };
  if (swept.failed) {
    // One write: saving progress first would reset attempts and the job could never give up.
    await failSocialJob(job, "a sweep batch could not be read", {
      cursor: read.nextBatch,
      total: read.totalBatches,
      state: job.state,
    });
    return { progress: "sweep batch failed, will retry", done: false };
  }
  await saveSocialJobProgress(job, read.nextBatch, { total: read.totalBatches, state: job.state });
  if (!swept.done)
    return { progress: `sweeping, ${swept.nextBatch}/${swept.totalBatches}`, done: false };
  return null;
}

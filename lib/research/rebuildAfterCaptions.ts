import { assertSocialJobActive } from "@/lib/research/assertSocialJobActive";
import { saveSocialJobState } from "@/lib/research/saveSocialJobState";
import { DOC_REBUILD_RESERVE_MS } from "@/lib/lore/const";
import type { ExtractionSlice } from "@/lib/credits/types";
import { refreshArtistDoc } from "@/lib/lore/refreshArtistDoc";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { failSocialJob } from "@/lib/research/failSocialJob";
import { queueLoreRefreshAfterCaptions } from "@/lib/research/queueLoreRefreshAfterCaptions";
import { saveSocialJobProgress } from "@/lib/research/saveSocialJobProgress";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * The caption job's last step: rebuild the Lore from the new credits, then
 * complete. The rebuild gets its own slice, since starting a model call on the
 * tail of a spent one let the platform kill us between the two writes.
 *
 * A first-time artist has no document yet: queue a durable Lore refresh after
 * captions become readable instead of silently skipping that first rebuild.
 *
 * @param job - The claimed job.
 * @param read - The slice that finished the batches.
 * @param deadline - When this slice must stop.
 * @returns The slice's outcome.
 */
export async function rebuildAfterCaptions(
  job: ResearchJob,
  read: ExtractionSlice,
  deadline: number,
): Promise<SliceOutcome> {
  await assertSocialJobActive(job);
  if ("directoryActivityId" in job.state) {
    await saveSocialJobState(job, { ...job.state, directoryCaptionsComplete: true });
    await completeResearchJob(job.id);
    return { progress: "Public captions prepared for artist review", done: true };
  }
  if (deadline - Date.now() < DOC_REBUILD_RESERVE_MS) {
    await saveSocialJobProgress(job, read.nextBatch, {
      total: read.totalBatches,
      state: job.state,
    });
    return { progress: "credits stored, document rebuild deferred", done: false };
  }
  if (job.state.resumedFromDirectoryJobId) {
    await queueLoreRefreshAfterCaptions(job);
    await saveSocialJobState(job, { ...job.state, directoryCaptionsComplete: true });
    await completeResearchJob(job.id);
    return { progress: "Captions complete, Lore refresh queued", done: true };
  }
  const rebuilt = await refreshArtistDoc(job.artistId);
  if (rebuilt === "failed") {
    await failSocialJob(job, "credits stored but the document rebuild failed");
    return { progress: "credits stored, document rebuild failed — will retry", done: false };
  }
  const queued = rebuilt === "no-document" ? await queueLoreRefreshAfterCaptions(job) : null;
  await completeResearchJob(job.id);
  return {
    progress: `complete, ${read.totalBatches} batch(es)${rebuilt === "no-material" ? ", no readable Lore material" : queued === null ? "" : queued ? ", Lore refresh queued" : ", Lore refresh already queued"}`,
    done: true,
  };
}

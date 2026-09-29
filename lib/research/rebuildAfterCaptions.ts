import { DOC_REBUILD_RESERVE_MS } from "@/lib/lore/const";
import type { ExtractionSlice } from "@/lib/credits/types";
import { refreshArtistDoc } from "@/lib/lore/refreshArtistDoc";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * The caption job's last step: rebuild the Lore from the new credits, then
 * complete. The rebuild gets its own slice, since starting a model call on the
 * tail of a spent one let the platform kill us between the two writes.
 *
 * "no-document" is not a failure: an artist who has never had a document has
 * nothing to rebuild, and every first-time artist arrives that way.
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
  if (deadline - Date.now() < DOC_REBUILD_RESERVE_MS) {
    await saveJobProgress(job.id, read.nextBatch, { total: read.totalBatches, state: job.state });
    return { progress: "credits stored, document rebuild deferred", done: false };
  }
  const rebuilt = await refreshArtistDoc(job.artistId);
  if (rebuilt === "failed") {
    await failResearchJob(job.id, "credits stored but the document rebuild failed");
    return { progress: "credits stored, document rebuild failed — will retry", done: false };
  }
  await completeResearchJob(job.id);
  return {
    progress: `complete, ${read.totalBatches} batch(es)${rebuilt === "no-document" ? ", no document to rebuild" : ""}`,
    done: true,
  };
}

import { DOC_REBUILD_RESERVE_MS } from "@/lib/lore/const";
import { refreshArtistDoc } from "@/lib/lore/refreshArtistDoc";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import { settleLoreRefresh } from "@/lib/research/settleLoreRefresh";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * One slice of a `lore_refresh` job: rebuild the Lore under the claim the job
 * was queued with. The rebuild is a model call of its own, so a slice without
 * `DOC_REBUILD_RESERVE_MS` left waits for one that can finish it.
 *
 * @param job - The claimed job.
 * @param deadline - When the slice must stop, in ms since the epoch.
 * @returns What the slice did. Throws when the rebuild failed, so the caller counts the attempt.
 */
export async function runLoreRefresh(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  if (deadline - Date.now() < DOC_REBUILD_RESERVE_MS) {
    await saveJobProgress(job.id, job.cursor);
    return { progress: "Waiting for a full Lore rebuild budget", done: false, waiting: true };
  }
  // Jobs queued before claims were recorded can't be fenced to an owner.
  if (!Object.prototype.hasOwnProperty.call(job.state, "claimId")) {
    await completeResearchJob(job.id);
    return { progress: "Legacy Lore refresh cancelled; use Look again to retry", done: true };
  }
  const expectedClaimId = typeof job.state.claimId === "string" ? job.state.claimId : null;
  const result = await refreshArtistDoc(job.artistId, {
    createIfMissing: true,
    jobId: job.id,
    expectedClaimId,
  });
  if (result === "failed") throw new Error("Could not rebuild Lore from current sources");
  const done = await settleLoreRefresh(job.id, String(job.state?.requestedAt ?? ""));
  if (!done) return { progress: "Sources changed during rebuild; another refresh is queued", done };
  if (result === "cancelled")
    return { progress: "Lore refresh cancelled after ownership changed", done };
  if (result === "no-material") return { progress: "No readable Lore material is ready yet", done };
  return { progress: "Lore rebuilt from current documents and sources", done };
}

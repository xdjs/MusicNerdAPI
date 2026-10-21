import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { MAX_ATTEMPTS, SOURCE_SEARCH_MIN_SLICE_MS } from "@/lib/research/const";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { searchAndPopulateVault } from "@/lib/vault/searchAndPopulateVault";
import { checkpointEditorSourceSearch } from "./checkpointEditorSourceSearch";

/** At most one external pipeline invocation per request; an uncertain started attempt cannot replay. */
export async function runEditorSourceSearchJob(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome> {
  const waiting = {
    done: false,
    waiting: true,
    progress: "Source search is waiting for its lease",
  };
  if (job.state.executionStarted) {
    return (await checkpointEditorSourceSearch(job, "interrupted"))
      ? { done: true, progress: "Source search was interrupted; retained sources remain available" }
      : waiting;
  }
  if (job.attempts >= MAX_ATTEMPTS) {
    return (await checkpointEditorSourceSearch(job, "failed"))
      ? { done: true, progress: "Source search could not start within its retry limit" }
      : waiting;
  }
  if (deadline - Date.now() < SOURCE_SEARCH_MIN_SLICE_MS) {
    await checkpointEditorSourceSearch(job, "pending");
    return waiting;
  }
  let started;
  try {
    started = await checkpointEditorSourceSearch(job, "start");
  } catch {
    // An uncertain marker commit MUST NOT run the pipeline. A fenced terminal
    // update is safe whether the marker committed or ownership was revoked.
    const saved = await checkpointEditorSourceSearch(job, "failed");
    return saved ? { done: true, progress: "Source search could not start" } : waiting;
  }
  if (!started?.userId) return waiting;
  try {
    await withArtistOperation(
      job.artistId,
      {
        userId: started.userId,
        expectedClaimId: typeof started.state.claimId === "string" ? started.state.claimId : null,
        activityId: job.activityId ?? undefined,
        trigger: "editor_search",
        sourceOrigin: "research",
      },
      () => searchAndPopulateVault(job.artistId, { deadline, requireComplete: true }),
    );
  } catch {
    return (await checkpointEditorSourceSearch(job, "failed"))
      ? { done: true, progress: "Source search stopped; retained sources remain available" }
      : waiting;
  }
  return (await checkpointEditorSourceSearch(job, "done"))
    ? { done: true, progress: "Source search finished" }
    : waiting;
}

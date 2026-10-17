import type { IngestResult } from "@/lib/instagram/types";
import type { ResearchJob } from "@/lib/research/types";
import type { LatestRefreshState, SourceResult } from "./types";
import { latestRefreshStore } from "./latestRefreshStore";

/** Persist the one-shot empty-window verification before another paid start. */
export async function resolveLatestInstagramResult(
  job: ResearchJob,
  result: IngestResult,
): Promise<SourceResult> {
  const state = job.state as unknown as LatestRefreshState;
  if (result.providerError) {
    if (result.providerError === "no_items" && state.scan?.after && !state.instagramVerification) {
      state.instagramVerification = {
        originalRunId: state.runId!,
        originalDatasetId: state.datasetId!,
        after: state.scan.after,
      };
      state.scan = { ...state.scan, after: undefined, providerLimited: undefined };
      delete state.runId;
      delete state.datasetId;
      delete state.providerStarted;
      await latestRefreshStore(job, state);
      return { status: "pending", detail: "verifying_empty_window" };
    }
    state.instagramFailure = {
      phase: "collection",
      reason:
        result.providerError === "no_items"
          ? "Instagram returned no readable posts; access or empty account could not be verified"
          : "Instagram returned a provider error; saved posts were retained",
      at: new Date().toISOString(),
    };
    await latestRefreshStore(job, state);
    return { status: "failed", detail: "instagram_unavailable" };
  }
  const checkedAt = new Date().toISOString();
  const after = state.instagramVerification?.after;
  const older = after && result.newestPostAt && Date.parse(result.newestPostAt) < Date.parse(after);
  state.instagramObservation = {
    outcome: result.noNewPosts ? "no_new_posts" : older ? "older_posts_found" : "posts_imported",
    checkedAt,
    ...(after ? { after } : {}),
    ...(result.newestPostAt ? { newestPostAt: result.newestPostAt } : {}),
  };
  delete state.instagramFailure;
  return { status: "checked", checkedAt, detail: state.instagramObservation.outcome };
}

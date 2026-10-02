import { checkInstagramScrape } from "@/lib/instagram/checkInstagramScrape";
import { persistSocialResearch } from "@/lib/social/persistSocialResearch";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { planSocialResearch } from "@/lib/social/planSocialResearch";
import { startSocialScrape } from "@/lib/social/startSocialScrape";
import { collectSocialScrape } from "@/lib/social/collectSocialScrape";
import type { AdditionalSocialState } from "@/lib/social/types";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { socialTaskIsConnected } from "@/lib/social/socialTaskIsConnected";

/** Runs one durable additional-source stage. A failed optional source never discards other research. */
export async function runAdditionalSocialResearch(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome | null> {
  if (deadline - Date.now() < 35_000) {
    job.state = { ...job.state, instagramFinished: true };
    await persistSocialResearch(job, true);
    return { done: false, waiting: true, progress: "Waiting for social research budget" };
  }
  const state: AdditionalSocialState = (job.state.additionalSocial as AdditionalSocialState) ?? {
    tasks: await planSocialResearch(job.artistId, job.state.force === true),
    index: 0,
  };
  if (
    !Array.isArray(state.tasks) ||
    !Number.isInteger(state.index) ||
    state.index < 0 ||
    state.index > state.tasks.length
  )
    throw new Error("invalid additional social state");
  job.state = { ...job.state, instagramFinished: true, additionalSocial: state };
  const task = state.tasks[state.index];
  if (!task) return null;
  let failure: string | undefined;
  let retryable = false;
  const connected = await withResearchJobWrite(job.artistId, job.id, writer =>
    socialTaskIsConnected(job.artistId, task, writer),
  );
  if (!connected) failure = "social profile changed or disconnected";
  else if (!task.runId) {
    if (task.startRequested)
      failure = "apify start outcome unknown; inspect provider before retrying";
    else {
      task.startRequested = true;
      await persistSocialResearch(job, false);
      const result = await startSocialScrape(task);
      if (result.status === "started") task.runId = result.runId;
      else failure = result.status === "failed" ? result.reason : "apify did not start";
    }
  } else if (!task.datasetId) {
    const result = await checkInstagramScrape(task.runId);
    if (result.status === "ready") {
      task.datasetId = result.datasetId;
      task.attempts = 0;
    } else if (result.status === "failed") {
      failure = result.reason;
      retryable = result.retryable === true;
    }
  } else {
    const stored = await collectSocialScrape(job.artistId, job.id, task);
    if (stored === null) {
      failure = "could not collect saved dataset";
      retryable = true;
    } else {
      task.status = "checked";
      task.stored = stored;
      delete task.failure;
      state.index++;
    }
  }
  if (failure) {
    task.attempts = (task.attempts ?? 0) + 1;
    task.failure = failure;
    if (!retryable || task.attempts >= 4) {
      task.status = "failed";
      state.index++;
    }
  }
  // Persist the saved provider id before releasing the slice. No inline polling.
  if (state.index < state.tasks.length) {
    await persistSocialResearch(job, true);
    return { done: false, waiting: true, progress: `Reading ${state.tasks[state.index].source}` };
  }
  await persistSocialResearch(job, false);
  return null;
}

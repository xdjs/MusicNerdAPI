import { checkInstagramScrape } from "@/lib/instagram/checkInstagramScrape";
import { collectInstagramScrape } from "@/lib/instagram/collectInstagramScrape";
import { hasSocialPosts } from "@/lib/instagram/hasSocialPosts";
import { instagramHandleFor } from "@/lib/instagram/instagramHandleFor";
import { startInstagramScrape } from "@/lib/instagram/startInstagramScrape";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { COLLECTION_RESERVE_MS } from "@/lib/research/const";
import { enqueueResearchJob } from "@/lib/research/enqueueResearchJob";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import { saveJobState } from "@/lib/research/saveJobState";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * One slice of a `social_ingest` job: fetch the artist's Instagram feed across
 * as many slices as it takes. A scrape runs one to five minutes and a slice
 * has sixty seconds, so the run is started and its id saved before anything
 * else can go wrong; later slices poll it, then store the posts nine at a time.
 * When the feed is stored, a `caption_extract` job is queued.
 *
 * @param job - The claimed job.
 * @param deadline - When this slice must stop, in epoch milliseconds.
 * @returns What the slice did.
 */
export async function runIngest(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  const force = job.state.force === true;
  const runId = typeof job.state.apifyRunId === "string" ? job.state.apifyRunId : null;
  const readyDatasetId =
    typeof job.state.apifyDatasetId === "string" ? job.state.apifyDatasetId : null;
  // A finished scrape is immutable: resume its saved dataset and handle.
  const handle =
    readyDatasetId && typeof job.state.instagramHandle === "string"
      ? job.state.instagramHandle
      : await instagramHandleFor(job.artistId);
  if (handle === "error") {
    await failResearchJob(job.id, "could not read the artist's handle");
    return { progress: "handle lookup failed, will retry", done: false };
  }
  if (!handle) {
    await completeResearchJob(job.id);
    return { progress: "no instagram handle", done: true };
  }

  if (!force && !runId && (await hasSocialPosts(job.artistId))) {
    await completeResearchJob(job.id);
    await enqueueResearchJob(job.artistId, "caption_extract", { parentJobId: job.id });
    return { progress: "posts already present", done: true };
  }

  if (!runId) {
    const started = await startInstagramScrape(handle);
    if (started.status !== "started") {
      const reason = started.status === "failed" ? started.reason : "apify did not start";
      await failResearchJob(job.id, reason);
      return { progress: `scrape did not start: ${reason}`, done: false };
    }
    await saveJobProgress(job.id, job.cursor, {
      state: { ...job.state, apifyRunId: started.runId },
    });
    return { progress: `scrape started (${started.runId})`, done: false, waiting: true };
  }

  const run = readyDatasetId
    ? { status: "ready" as const, runId, datasetId: readyDatasetId }
    : await checkInstagramScrape(runId);
  if (run.status === "started" || run.status === "running") {
    await saveJobProgress(job.id, job.cursor, { state: job.state });
    return { progress: "scrape still running", done: false, waiting: true };
  }
  if (run.status === "failed") {
    await failResearchJob(job.id, run.reason);
    return { progress: `scrape failed: ${run.reason}`, done: false };
  }

  const collectionState = {
    ...job.state,
    apifyDatasetId: run.datasetId,
    instagramHandle: handle,
  };
  if (deadline - Date.now() < COLLECTION_RESERVE_MS) {
    await saveJobProgress(job.id, job.cursor, { state: collectionState });
    return {
      progress: "Waiting for a full thumbnail collection budget",
      done: false,
      waiting: true,
    };
  }
  const result = await collectInstagramScrape(
    job.artistId,
    handle,
    run.datasetId,
    job.id,
    job.cursor,
  );
  if (result === null) {
    // A failed dataset read is not an empty feed: keep the dataset and retry.
    await saveJobState(job.id, collectionState);
    await failResearchJob(job.id, "could not collect the finished scrape");
    return { progress: "collection failed, will retry", done: false };
  }
  if (result.nextCursor !== undefined) {
    await saveJobProgress(job.id, result.nextCursor, { state: collectionState });
    return {
      progress: `Stored posts and thumbnails through ${result.nextCursor}`,
      done: false,
      waiting: true,
    };
  }
  await completeResearchJob(job.id);
  await enqueueResearchJob(job.artistId, "caption_extract", {
    parentJobId: job.id,
    state: force ? { incremental: true } : {},
  });
  return { progress: `ingested ${job.cursor + result.ingested} post(s)`, done: true };
}

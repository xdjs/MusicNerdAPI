import { assertSocialJobActive } from "@/lib/research/assertSocialJobActive";
import { prepareSocialRefresh } from "@/lib/socialRefresh/prepareSocialRefresh";
import { persistSocialResearch } from "@/lib/social/persistSocialResearch";
import type { SocialScan } from "@/lib/socialRefresh/types";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { DEFAULT_SCRAPE_LIMIT } from "@/lib/instagram/const";
import { checkInstagramScrape } from "@/lib/instagram/checkInstagramScrape";
import { collectInstagramScrape } from "@/lib/instagram/collectInstagramScrape";
import { instagramHandleFor } from "@/lib/instagram/instagramHandleFor";
import { startInstagramScrape } from "@/lib/instagram/startInstagramScrape";
import { COLLECTION_RESERVE_MS } from "@/lib/research/const";
import { finishSocialIngest } from "@/lib/research/finishSocialIngest";
import { failSocialJob } from "@/lib/research/failSocialJob";
import { saveSocialJobProgress } from "@/lib/research/saveSocialJobProgress";
import { saveSocialJobState } from "@/lib/research/saveSocialJobState";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * One slice of a `social_ingest` job: fetch the artist's Instagram feed across
 * as many slices as it takes. A scrape runs one to five minutes and a slice
 * has sixty seconds, so the run is started and its id saved before anything
 * else can go wrong; later slices poll it, then store the posts nine at a time.
 * After Instagram, the same durable job reads connected TikTok/X profiles
 * and selected reel audio before queuing `caption_extract`.
 *
 * @param job - The claimed job.
 * @param deadline - When this slice must stop, in epoch milliseconds.
 * @returns What the slice did.
 */
export async function runIngest(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  if (!job.state || typeof job.state !== "object" || Array.isArray(job.state))
    throw new Error("invalid social research state");
  await assertSocialJobActive(job);
  if (job.state.instagramFinished === true)
    return finishSocialIngest(job, deadline, "social research finished");
  const runId = typeof job.state.apifyRunId === "string" ? job.state.apifyRunId : null;
  const readyDatasetId =
    typeof job.state.apifyDatasetId === "string" ? job.state.apifyDatasetId : null;
  // A finished scrape is immutable: resume its saved dataset and handle.
  const handle =
    readyDatasetId && typeof job.state.instagramHandle === "string"
      ? job.state.instagramHandle
      : await instagramHandleFor(job.artistId);
  if (runId && ("directoryActivityId" in job.state || "resumedFromDirectoryJobId" in job.state)) {
    const currentHandle = await instagramHandleFor(job.artistId);
    await assertSocialJobActive(job);
    if (
      typeof job.state.instagramHandle !== "string" ||
      currentHandle !== job.state.instagramHandle
    ) {
      await failSocialJob(
        job,
        "Saved Instagram run belongs to a changed or unverified profile; review before retrying",
      );
      return { progress: "Saved social profile changed", done: false };
    }
  }
  if (handle === "error") {
    await failSocialJob(job, "could not read the artist's handle");
    return { progress: "handle lookup failed, will retry", done: false };
  }
  if (!handle) {
    return finishSocialIngest(job, deadline, "no instagram handle");
  }

  if (
    typeof job.state.instagramHandle === "string" &&
    normalizeHandle(job.state.instagramHandle) !== normalizeHandle(handle)
  ) {
    await failSocialJob(job, "Instagram account changed during refresh");
    return { done: false, progress: "Instagram account changed" };
  }

  if (!runId) {
    await assertSocialJobActive(job);
    if (job.state.instagramStartRequested === true) {
      if ("directoryActivityId" in job.state || "resumedFromDirectoryJobId" in job.state)
        throw new Error("Instagram start outcome unknown; inspect provider before retrying");
      await failSocialJob(job, "Apify start outcome unknown; inspect existing run before retrying");
      return { done: false, progress: "Instagram start requires inspection" };
    }
    const scan = await prepareSocialRefresh(job, "instagram", handle);
    if (scan.needsReview) {
      job.state = { ...job.state, instagramRefreshNeedsReview: true };
      return finishSocialIngest(job, deadline, "Instagram continuity needs review");
    }
    if (scan.skip) return finishSocialIngest(job, deadline, "Reusing recent Instagram check");
    job.state = {
      ...job.state,
      instagramHandle: handle,
      instagramScan: scan,
      instagramStartRequested: true,
    };
    await persistSocialResearch(job, false);
    await assertSocialJobActive(job);
    const started = await startInstagramScrape(handle, {
      ...(scan.after ? { onlyPostsNewerThan: scan.after } : {}),
    });
    await assertSocialJobActive(job);
    if (started.status !== "started") {
      if (
        started.status === "failed" &&
        started.startRejected &&
        job.state.instagramStartRequested
      ) {
        job.state = { ...job.state, instagramStartRequested: false };
        await saveSocialJobState(job, job.state);
      }
      const reason = started.status === "failed" ? started.reason : "apify did not start";
      await failSocialJob(job, reason);
      return { progress: `scrape did not start: ${reason}`, done: false };
    }
    job.state = { ...job.state, apifyRunId: started.runId };
    await persistSocialResearch(job, true);
    return { progress: `scrape started (${started.runId})`, done: false, waiting: true };
  }

  const run = readyDatasetId
    ? { status: "ready" as const, runId, datasetId: readyDatasetId }
    : await checkInstagramScrape(runId);
  await assertSocialJobActive(job);
  if (run.status === "started" || run.status === "running") {
    await saveSocialJobProgress(job, job.cursor, { state: job.state });
    return { progress: "scrape still running", done: false, waiting: true };
  }
  if (run.status === "failed") {
    await failSocialJob(job, run.reason);
    return { progress: `scrape failed: ${run.reason}`, done: false };
  }

  const collectionState = {
    ...job.state,
    apifyDatasetId: run.datasetId,
    instagramHandle: handle,
    ...(job.state.instagramScan
      ? {
          instagramScan: {
            ...(job.state.instagramScan as SocialScan),
            ...(run.limitReached ? { providerLimited: true } : {}),
          },
        }
      : {}),
  };
  if (deadline - Date.now() < COLLECTION_RESERVE_MS) {
    await saveSocialJobProgress(job, job.cursor, { state: collectionState });
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
    ...(collectionState.instagramScan
      ? [
          {
            refresh: {
              scan: collectionState.instagramScan as SocialScan,
              runId,
              limit: DEFAULT_SCRAPE_LIMIT,
            },
          },
        ]
      : []),
  );
  await assertSocialJobActive(job);
  if (result === null) {
    // A failed dataset read is not an empty feed: keep the dataset and retry.
    await saveSocialJobState(job, collectionState);
    await failSocialJob(job, "could not collect the finished scrape");
    return { progress: "collection failed, will retry", done: false };
  }
  if (result.nextCursor !== undefined) {
    await saveSocialJobProgress(job, result.nextCursor, { state: collectionState });
    return {
      progress: `Stored posts and thumbnails through ${result.nextCursor}`,
      done: false,
      waiting: true,
    };
  }
  job.state = collectionState;
  return finishSocialIngest(job, deadline, `ingested ${job.cursor + result.ingested} post(s)`);
}

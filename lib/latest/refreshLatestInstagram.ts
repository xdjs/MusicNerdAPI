import { withoutAt } from "@/lib/artists/withoutAt";
import { checkInstagramScrape } from "@/lib/instagram/checkInstagramScrape";
import { collectInstagramScrape } from "@/lib/instagram/collectInstagramScrape";
import { startInstagramScrape } from "@/lib/instagram/startInstagramScrape";
import {
  LATEST_COLLECT_RESERVE_MS,
  LATEST_MAX_CHARGE_USD,
  LATEST_POST_LIMIT,
  LATEST_WINDOW_MS,
} from "@/lib/latest/const";
import { latestRefreshStore } from "@/lib/latest/latestRefreshStore";
import type { LatestRefreshState, SourceResult } from "@/lib/latest/types";
import type { ResearchJob } from "@/lib/research/types";

/**
 * One step of Update Latest's Instagram check: start a small capped Apify run,
 * wait for it, then store the newest posts. Only the saved run is ever
 * resumed; a lost start response never starts another paid run.
 *
 * @param job - The running `latest_refresh` job (its state is updated in place).
 * @param deadline - When the slice must stop, in epoch milliseconds.
 * @returns The Instagram source's result.
 */
export async function refreshLatestInstagram(
  job: ResearchJob,
  deadline: number,
): Promise<SourceResult> {
  const state = job.state as unknown as LatestRefreshState;
  const handle = withoutAt(state.instagram?.trim() ?? "");
  if (!handle) return { status: "disconnected" };
  if (!process.env.APIFY_API_TOKEN) return { status: "failed" };
  if (!state.runId) {
    if (state.providerStarted) return { status: "failed" };
    state.providerStarted = true;
    await latestRefreshStore(job, state);
    const run = await startInstagramScrape(handle, {
      limit: LATEST_POST_LIMIT,
      maxTotalChargeUsd: LATEST_MAX_CHARGE_USD,
      onlyPostsNewerThan: new Date(Date.now() - LATEST_WINDOW_MS).toISOString(),
    });
    if (run.status !== "started") return { status: "failed" };
    state.runId = run.runId;
    await latestRefreshStore(job, state);
    return { status: "pending" };
  }
  if (!state.datasetId) {
    const run = await checkInstagramScrape(state.runId);
    if (run.status === "failed") {
      state.instagramFailure = {
        phase: "status",
        reason: run.reason,
        at: new Date().toISOString(),
      };
      await latestRefreshStore(job, state);
      // The queue counts failures and stops after four attempts. Keep the saved
      // paid run; a status-request failure is not proof the scrape failed.
      if (run.retryable) throw new Error(run.reason);
      return { status: "failed" };
    }
    if (run.status !== "ready") return { status: "pending" };
    state.datasetId = run.datasetId;
    await latestRefreshStore(job, state);
  }
  if (deadline - Date.now() < LATEST_COLLECT_RESERVE_MS) return { status: "pending" };
  const stored = await collectInstagramScrape(job.artistId, handle, state.datasetId, job.id, 0, {
    latestOnly: true,
  });
  if (!stored) {
    const reason = "Instagram collection unavailable";
    state.instagramFailure = { phase: "collection", reason, at: new Date().toISOString() };
    await latestRefreshStore(job, state);
    throw new Error(reason);
  }
  return { status: "checked", checkedAt: new Date().toISOString() };
}

import { refreshLatestProvider } from "@/lib/latestProviders/refreshLatestProvider";
import { LATEST_COLLECT_RESERVE_MS } from "@/lib/latest/const";
import { authorizeLatestRefresh } from "@/lib/latest/authorizeLatestRefresh";
import { latestRefreshStore } from "@/lib/latest/latestRefreshStore";
import { refreshLatestInstagram } from "@/lib/latest/refreshLatestInstagram";
import type { LatestRefreshState } from "@/lib/latest/types";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * One bounded slice of an explicit Update Latest job. Public provider snapshots
 * are refreshed here; reads never contact providers. Collection only: no
 * extraction, discovery, Lore or About.
 *
 * @param job - The claimed `latest_refresh` job.
 * @param deadline - When the slice must stop, in epoch milliseconds.
 * @returns What the slice did; `waiting` while the Apify run is going.
 */
export async function runLatestRefresh(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  await authorizeLatestRefresh(job);
  const state = job.state as unknown as LatestRefreshState;
  let resetAttempts = false;
  const provider = (["inprocess", "spotify", "deezer"] as const).find(
    p => state.sources[p]?.status === "pending",
  );
  if (provider) {
    if (deadline - Date.now() > 10000)
      state.sources[provider] = await refreshLatestProvider(job, provider);
    const done = !Object.values(state.sources).some(source => source.status === "pending");
    await latestRefreshStore(job, state, done, true);
    return done
      ? { done, progress: "Latest check finished" }
      : { done, waiting: true, progress: "Checking Latest sources" };
  }
  if (state.sources.interviews?.status === "pending")
    state.sources.interviews = { status: "checked", checkedAt: new Date().toISOString() };
  if (
    state.sources.instagram?.status === "pending" &&
    deadline - Date.now() > LATEST_COLLECT_RESERVE_MS
  ) {
    const { resetAttempts: reset = false, ...result } = await refreshLatestInstagram(job, deadline);
    resetAttempts = reset;
    state.sources.instagram = result;
  }
  const done = !Object.values(state.sources).some(source => source.status === "pending");
  await latestRefreshStore(job, state, done, resetAttempts);
  return done
    ? { done, progress: "Latest check finished" }
    : { done, waiting: true, progress: "Checking Instagram" };
}

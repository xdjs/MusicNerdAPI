import { LATEST_COLLECT_RESERVE_MS } from "@/lib/latest/const";
import { authorizeLatestRefresh } from "@/lib/latest/authorizeLatestRefresh";
import { latestRefreshStore } from "@/lib/latest/latestRefreshStore";
import { refreshLatestInstagram } from "@/lib/latest/refreshLatestInstagram";
import type { LatestRefreshState } from "@/lib/latest/types";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * One slice of an Update Latest job: the Instagram check. MusicNerdWeb checks
 * In Process, Spotify, Deezer and published answers inline when the job is
 * requested, because those checks expire its own cache. Collection only: no
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
  if (
    state.sources.instagram?.status === "pending" &&
    deadline - Date.now() > LATEST_COLLECT_RESERVE_MS
  ) {
    const { resetAttempts: reset = false, ...result } = await refreshLatestInstagram(job, deadline);
    resetAttempts = reset;
    state.sources.instagram = result;
  }
  const done = state.sources.instagram?.status !== "pending";
  await latestRefreshStore(job, state, done, resetAttempts);
  return done
    ? { done, progress: "Latest check finished" }
    : { done, waiting: true, progress: "Checking Instagram" };
}

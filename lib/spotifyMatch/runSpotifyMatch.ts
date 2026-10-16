import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { MAX_ATTEMPTS } from "@/lib/research/const";
import { checkSpotifyCooldown } from "@/lib/spotify/checkSpotifyCooldown";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
import { parseSpotifyMatchState } from "./parseSpotifyMatchState";
import { spotifyMatchEligible } from "./spotifyMatchEligible";
import { saveSpotifyMatchProgress } from "./saveSpotifyMatchProgress";
import { readSpotifyMatchStep } from "./readSpotifyMatchStep";
import { chooseVerifiedSpotifyMatch } from "./chooseVerifiedSpotifyMatch";
import { attachSpotifyMatch } from "./attachSpotifyMatch";

/** Independent resumable catalog matching; never replays Lore discovery, scraping or profile creation. */
export async function runSpotifyMatch(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  const state = parseSpotifyMatchState(job.state);
  const finish = async (outcome: string, failed = false) => {
    const saved = await saveSpotifyMatchProgress(
      job,
      { ...(state ?? job.state), outcome },
      { status: failed ? "failed" : "done" },
    );
    return {
      done: saved,
      waiting: !saved,
      progress: saved ? `Spotify matching: ${outcome}` : "Spotify matching lease changed",
    };
  };
  if (!state) return finish("invalid_state", true);
  if (job.attempts >= MAX_ATTEMPTS || state.expiresAtMs <= Date.now())
    return finish("expired", true);
  if (!(await spotifyMatchEligible(job, state))) return finish("identity_changed");
  if (deadline - Date.now() < 6000) {
    await saveSpotifyMatchProgress(job, { ...state, nextAttemptAtMs: Date.now() + 60_000 });
    return { done: false, waiting: true, progress: "Spotify matching waits for a full slice" };
  }
  try {
    if (
      state.phase === "spotify" &&
      (state.isrcs ?? []).every(isrc => state.matches?.some(match => match.isrc === isrc))
    ) {
      const result = chooseVerifiedSpotifyMatch(state.artistName, state.matches ?? []);
      if (result.status !== "verified") return finish(result.status);
      if (await attachSpotifyMatch(job, state, result.spotifyId))
        return { done: true, progress: "Verified Spotify profile added" };
      return finish("review_required");
    }
    await checkSpotifyCooldown();
    const next = await readSpotifyMatchStep(state, deadline);
    delete next.nextAttemptAtMs;
    const saved = await saveSpotifyMatchProgress(job, next, {});
    return {
      done: false,
      waiting: !saved,
      progress: saved ? "Spotify matching progress saved" : "Spotify matching lease changed",
    };
  } catch (error) {
    const deferred = error instanceof SpotifyDeferredError;
    const failure = !deferred || error.requested;
    const terminal = job.attempts + (failure ? 1 : 0) >= MAX_ATTEMPTS;
    const nextAttemptAtMs = deferred ? error.retryAtMs : Date.now() + 60_000 * 2 ** job.attempts;
    const saved = await saveSpotifyMatchProgress(
      job,
      {
        ...state,
        nextAttemptAtMs: Math.min(nextAttemptAtMs, state.expiresAtMs),
        ...(terminal ? { outcome: "failed" } : {}),
      },
      {
        status: terminal ? "failed" : "pending",
        failure,
        error: deferred ? "Spotify rate limited; deferred" : "Spotify matching request failed",
      },
    );
    if (!saved) return { done: false, waiting: true, progress: "Spotify matching lease changed" };
    return {
      done: terminal,
      waiting: true,
      progress: terminal ? "Spotify matching needs review" : "Spotify matching deferred",
    };
  }
}

import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { MAX_ATTEMPTS } from "@/lib/research/const";
import { checkSpotifyCooldown } from "@/lib/spotify/checkSpotifyCooldown";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
import { resolveCatalogCounterpart } from "@/lib/musicPlatform/resolveCatalogCounterpart";
import { parseCatalogMatchState } from "./parseCatalogMatchState";
import { catalogMatchEligibility } from "./catalogMatchEligibility";
import { saveCatalogMatch } from "./saveCatalogMatch";
import { finishCatalogMatch } from "./finishCatalogMatch";
/** One bounded bidirectional identity job. No model calls, unbounded polling, or exclusion overrides. */
export async function runCatalogMatch(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  const state = parseCatalogMatchState(job.state);
  const finish = async (outcome: string, failed = false) => ({
    done: await saveCatalogMatch(
      job,
      { ...(state ?? job.state), outcome },
      failed ? "failed" : "done",
    ),
    progress: `Catalog matching: ${outcome}`,
  });
  if (!state) return finish("invalid_state", true);
  if (job.attempts >= MAX_ATTEMPTS) return finish("provider_failure", true);
  if (state.expiresAtMs <= Date.now()) return finish("expired", true);
  const eligible = await catalogMatchEligibility(job, state);
  if (eligible === "stale")
    return { done: false, waiting: true, progress: "Catalog matching lease changed" };
  if (eligible === "identity_changed" || eligible === "user_disconnected") return finish(eligible);
  if (!state.anchor.spotify && !state.anchor.deezer) return finish("identity_anchor_required");
  const defer = async (retryAtMs: number, failure = false) => {
    const terminal = job.attempts + (failure ? 1 : 0) >= MAX_ATTEMPTS;
    const saved = await saveCatalogMatch(
      job,
      {
        ...state,
        nextAttemptAtMs: Math.min(retryAtMs, state.expiresAtMs),
        ...(failure ? { outcome: "provider_failure" } : {}),
      },
      terminal ? "failed" : "pending",
      failure,
    );
    return {
      done: terminal && saved,
      waiting: true,
      progress: terminal ? "Catalog provider failure needs review" : "Catalog matching deferred",
    };
  };
  if (eligible === "legacy_running" || deadline - Date.now() < 20_000)
    return defer(Date.now() + 60_000);
  try {
    await checkSpotifyCooldown();
    const result = await resolveCatalogCounterpart({
      artistName: state.anchor.name,
      spotifyId: state.anchor.spotify ?? undefined,
      deezerId: state.anchor.deezer ?? undefined,
    });
    if (result.status === "provider_failure")
      return defer(
        Math.max(result.retryAtMs ?? 0, Date.now() + 60_000 * 2 ** job.attempts) +
          Math.floor(Math.random() * 10_000),
        result.failureConsumed ?? true,
      );
    if (result.status !== "verified") return finish(result.status);
    if (Date.now() >= deadline) return defer(Date.now() + 60_000, true);
    const done = await finishCatalogMatch(job, state, result);
    return {
      done,
      waiting: !done,
      progress: done ? "Catalog verification recorded" : "Catalog matching lease changed",
    };
  } catch (error) {
    if (error instanceof SpotifyDeferredError) return defer(error.retryAtMs, error.requested);
    throw error;
  }
}

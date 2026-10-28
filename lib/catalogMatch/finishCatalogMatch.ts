import { db } from "@/lib/db/db";
import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";
import { acquirePlatformIdentityLock } from "@/lib/artistLinks/acquirePlatformIdentityLock";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { canSaveMusicDestination } from "@/lib/musicLinks/canSaveMusicDestination";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import type { ResearchJob } from "@/lib/research/types";
import type { CatalogCounterpartResult } from "@/lib/musicPlatform/types";
import type { CatalogMatchState } from "./types";
import { catalogMatchEligibility } from "./catalogMatchEligibility";
import { saveCatalogMatch } from "./saveCatalogMatch";
/** Atomically recheck identity decisions and attach only a verified pair under the shared locks. */
export async function finishCatalogMatch(
  job: ResearchJob,
  state: CatalogMatchState,
  result: Extract<CatalogCounterpartResult, { status: "verified" }>,
): Promise<boolean> {
  try {
    return await db.transaction(async tx => {
      const target = state.anchor.spotify ? "deezer" : "spotify";
      const value = target === "deezer" ? result.deezerId : result.spotifyId;
      await acquireArtistPlatformLock(tx, job.artistId, "deezer");
      await acquireArtistPlatformLock(tx, job.artistId, "spotify");
      await acquirePlatformIdentityLock(tx, target, value);
      await lockArtistRow(tx, job.artistId);
      const eligibility = await catalogMatchEligibility(job, state, tx);
      if (eligibility === "stale") return false;
      if (eligibility !== "eligible")
        return saveCatalogMatch(job, { ...state, outcome: eligibility, result }, "done", false, tx);
      if (
        (state.anchor.spotify && state.anchor.spotify !== result.spotifyId) ||
        (state.anchor.deezer && state.anchor.deezer !== result.deezerId)
      )
        return saveCatalogMatch(job, { ...state, outcome: "identity_changed" }, "done", false, tx);
      const url =
        target === "spotify"
          ? `https://open.spotify.com/artist/${value}`
          : `https://www.deezer.com/artist/${value}`;
      if (
        !(await canSaveMusicDestination(tx, job.artistId, url, {
          allowExistingSameDestination: true,
        }))
      )
        return saveCatalogMatch(
          job,
          { ...state, outcome: "review_required", result },
          "done",
          false,
          tx,
        );
      if (
        !(await saveCatalogMatch(job, { ...state, outcome: "verified", result }, "done", false, tx))
      )
        return false;
      await writeArtistLinkColumn(
        tx,
        job.artistId,
        target,
        value,
        undefined,
        target === "deezer"
          ? { spotifyId: result.spotifyId, deezerId: value, previousDeezerId: null }
          : { deezerId: result.deezerId, spotifyId: value, previousSpotifyId: null },
      );
      return true;
    });
  } catch (error) {
    if (!(error instanceof ArtistLinkConflictError)) throw error;
    return saveCatalogMatch(job, { ...state, outcome: "review_required", result }, "done");
  }
}

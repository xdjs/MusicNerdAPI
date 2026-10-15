import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";
import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { canSaveMusicDestination } from "@/lib/musicLinks/canSaveMusicDestination";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { spotifyMatchEligible } from "./spotifyMatchEligible";
import { saveSpotifyMatchProgress } from "./saveSpotifyMatchProgress";
import type { ResearchJob } from "@/lib/research/types";
import type { SpotifyMatchState } from "./types";

/** Public catalog identity only; recheck every authority/conflict fence under the shared identity locks. */
export async function attachSpotifyMatch(
  job: ResearchJob,
  state: SpotifyMatchState,
  spotifyId: string,
): Promise<boolean> {
  return db.transaction(async tx => {
    // Lock both catalog slots alphabetically, then the destination identity and row.
    await acquireArtistPlatformLock(tx, job.artistId, "deezer");
    await acquireArtistPlatformWriteLocks(tx, job.artistId, "spotify", spotifyId);
    await lockArtistRow(tx, job.artistId);
    if (!(await spotifyMatchEligible(job, state, tx))) return false;
    const url = `https://open.spotify.com/artist/${spotifyId}`;
    if (!(await canSaveMusicDestination(tx, job.artistId, url))) return false;
    if (
      !(await saveSpotifyMatchProgress(
        job,
        { ...state, outcome: "matched", spotifyId },
        { status: "done" },
        tx,
      ))
    )
      return false;
    await writeArtistLinkColumn(tx, job.artistId, "spotify", spotifyId);
    await recordArtistActivity(
      job.artistId,
      "spotify_identity_matched",
      {
        actorKind: "system",
        trigger: "directory_add",
        parentActivityId: job.activityId ?? undefined,
      },
      tx,
    );
    return true;
  });
}

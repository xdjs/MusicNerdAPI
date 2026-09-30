import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { LatestRefreshState } from "@/lib/latest/types";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { ResearchJob } from "@/lib/research/types";

/**
 * Before each slice of a Latest check: the requester still holds the claim
 * they asked under, and the artist's connected identities are the ones they
 * asked to check.
 *
 * @param job - The claimed `latest_refresh` job.
 * @returns Nothing; throws OwnershipChangedError when either changed.
 */
export async function authorizeLatestRefresh(job: ResearchJob): Promise<void> {
  const state = job.state as unknown as LatestRefreshState;
  if (!job.activityId || !state.userId || !Object.hasOwn(state, "claimId"))
    throw new Error("Missing Latest attribution");
  await withArtistOperation(
    job.artistId,
    {
      userId: state.userId,
      expectedClaimId: state.claimId,
      activityId: job.activityId,
      trigger: "manual_latest_refresh",
    },
    () =>
      withScopedArtistWrite(job.artistId, async tx => {
        const rows = await tx.execute(sql`select a.id from artists a
          join artist_activity_events e on e.id = ${job.activityId}::uuid
          where a.id = ${job.artistId}::uuid and e.artist_id = a.id and e.actor_user_id = ${state.userId}::uuid
            and coalesce(a.instagram, '') = ${state.instagram ?? ""}
            and coalesce(a.inprocess, '') = ${state.inprocess ?? ""}
            and coalesce(a.spotify, '') = ${state.spotify ?? ""}
            and coalesce(a.deezer, '') = ${state.deezer ?? ""}`);
        if (!rowsOf(rows).length) throw new OwnershipChangedError();
      }),
  );
}

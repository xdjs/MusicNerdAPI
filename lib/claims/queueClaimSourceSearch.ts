import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { rowsOf } from "@/lib/db/rowsOf";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Queues web source research for a newly approved claim. Run inside the
 * approval's `withArtistOperation`, so the write re-checks the claim and is
 * attributed to the approving admin. A live search for another claim can't
 * stand in for this one; the worker cancels it.
 *
 * @param artistId - The artist.
 * @param claimId - The approved claim.
 * @returns True when a search for this claim is queued or already live.
 */
export async function queueClaimSourceSearch(artistId: string, claimId: string): Promise<boolean> {
  return withScopedArtistWrite(artistId, async tx => {
    const activityId = await recordArtistActivity(artistId, "source_search", {}, tx);
    const inserted = rowsOf(
      await tx.execute(sql`
        insert into artist_research_jobs (artist_id, kind, total, state, activity_id)
        values (${artistId}::uuid, 'source_search', ${null}, ${JSON.stringify({ claimId })}::jsonb, ${activityId}::uuid)
        on conflict do nothing returning id`),
    );
    if (inserted.length > 0) return true;
    const [live] = rowsOf(
      await tx.execute(sql`
        select state from artist_research_jobs
        where artist_id = ${artistId}::uuid and kind = 'source_search' and status in ('pending', 'running')
        limit 1`),
    ) as Array<{ state: { claimId?: unknown } | null }>;
    return live?.state?.claimId === claimId;
  });
}

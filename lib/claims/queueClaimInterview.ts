import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { rowsOf } from "@/lib/db/rowsOf";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Queues private interview preparation for a newly approved claim, once per
 * claim. It never offers a question to the artist. Run inside the approval's
 * `withArtistOperation`.
 *
 * @param artistId - The artist.
 * @param claimId - The approved claim.
 * @param userId - The claimant.
 * @returns True when preparation is queued, now or before.
 */
export async function queueClaimInterview(
  artistId: string,
  claimId: string,
  userId: string,
): Promise<boolean> {
  return withScopedArtistWrite(artistId, async tx => {
    const existing = rowsOf(
      await tx.execute(sql`select id from artist_research_jobs
        where artist_id=${artistId}::uuid and kind='interview_prepare'
        and state->>'claimId'=${claimId} limit 1`),
    );
    if (existing.length) return true;
    const activityId = await recordArtistActivity(
      artistId,
      "interview_prepare",
      { trigger: "claim_approval" },
      tx,
    );
    const state = {
      version: 1,
      mode: "claim_preparation",
      claimId,
      userId,
      createdAt: new Date().toISOString(),
    };
    const inserted = rowsOf(
      await tx.execute(sql`insert into artist_research_jobs (artist_id,kind,state,activity_id)
        values (${artistId}::uuid,'interview_prepare',${JSON.stringify(state)}::jsonb,${activityId}::uuid)
        on conflict do nothing returning id`),
    );
    return inserted.length > 0;
  });
}

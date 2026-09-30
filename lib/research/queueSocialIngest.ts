import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Queues an Instagram scrape for an artist, attributed to a new activity.
 * Takes the same artist lock as Update Latest (MusicNerdWeb #1391), and won't
 * start a competing scrape while Latest is checking Instagram.
 *
 * @param artistId - The artist.
 * @param state - The job's starting state, e.g. `{ force: true }`.
 * @returns True when a scrape is live afterwards; false while Latest owns the check or on a database error. A changed claim throws.
 */
export async function queueSocialIngest(
  artistId: string,
  state: Record<string, unknown>,
): Promise<boolean> {
  try {
    return await db.transaction(async tx => {
      if (getArtistOperationOwnership(artistId)) await lockScopedArtistWrite(tx, artistId);
      else await lockArtistRow(tx, artistId);
      const latest = await tx.execute(sql`select id from artist_research_jobs
        where artist_id=${artistId}::uuid and kind='latest_refresh'
        and status in ('pending','running') and state->'sources'->'instagram'->>'status'='pending'
        limit 1`);
      if (rowsOf(latest).length) return false;
      const activityId = await recordArtistActivity(artistId, "social_ingest", {}, tx);
      await tx.execute(sql`
        insert into artist_research_jobs (artist_id, kind, total, state, activity_id)
        values (${artistId}::uuid, ${"social_ingest"}, ${null}, ${JSON.stringify(state)}::jsonb, ${activityId}::uuid)
        on conflict do nothing`);
      return true;
    });
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw e;
    console.error("[queueSocialIngest] Error:", e);
    return false;
  }
}

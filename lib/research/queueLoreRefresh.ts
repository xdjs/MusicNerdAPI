import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { TransactionDb } from "@/lib/ownership/types";

/**
 * Queues a Lore rebuild under the claim it was requested for. A request that
 * arrives while one is running marks it (`requestedAt`), so the rebuild runs
 * again against the newer sources.
 *
 * @param artistId - The artist.
 * @param expectedClaimId - The artist's approved claim when the request was made.
 * @param opts - Request options.
 * @param opts.manual - A person pressed the button: skip when a refresh is live or ran in the last 30 minutes.
 * @param writer - Existing transaction when the request must commit with its source edit.
 * @returns False when a manual request was skipped; true otherwise. A changed claim throws.
 */
export async function queueLoreRefresh(
  artistId: string,
  expectedClaimId: string | null,
  opts?: { manual?: boolean },
  writer?: TransactionDb,
): Promise<boolean> {
  const enqueue = async (tx: TransactionDb) => {
    await lockArtistRow(tx, artistId);
    const claim = await findApprovedClaim(tx, artistId);
    if ((claim?.id ?? null) !== expectedClaimId) throw new OwnershipChangedError();
    // A repeated click must not advance requestedAt and rerun Gemini.
    if (opts?.manual) {
      const recent = await tx.execute(sql`
        select id from artist_research_jobs
         where artist_id = ${artistId}::uuid and kind = 'lore_refresh'
           and (status in ('pending', 'running') or created_at > now() - interval '30 minutes')
         limit 1`);
      if (rowsOf(recent).length > 0) return false;
    }
    const activityId = await recordArtistActivity(artistId, "lore_refresh", {}, tx);
    const state = JSON.stringify({ claimId: expectedClaimId });
    await tx.execute(sql`
      insert into artist_research_jobs (artist_id, kind, state, activity_id)
      values (${artistId}::uuid, 'lore_refresh', ${state}::jsonb, ${activityId}::uuid)
      on conflict (artist_id, kind) where status in ('pending', 'running') do update
      set state = jsonb_set(${state}::jsonb, '{requestedAt}', to_jsonb(clock_timestamp()::text)),
          status = case when artist_research_jobs.status = 'running' then 'running' else 'pending' end,
          attempts = 0, updated_at = now()`);
    return true;
  };
  return writer ? enqueue(writer) : db.transaction(enqueue);
}

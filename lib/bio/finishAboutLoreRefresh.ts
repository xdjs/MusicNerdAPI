import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { AboutLoreLease } from "@/lib/bio/types";
import { MAX_ATTEMPTS } from "@/lib/research/const";

/** Release only this request's exact lease, preserving newer refresh requests and surfacing cleanup failure. */
export async function finishAboutLoreRefresh(
  artistId: string,
  lease: AboutLoreLease,
  outcome: "rebuilt" | "no-material" | "cancelled" | "changed" | "failed",
): Promise<boolean> {
  const rows = rowsOf(
    await db.execute(sql`
  update artist_research_jobs set
    status=case
      when coalesce(state->>'requestedAt','')<>${lease.requestedAt} or ${outcome}='changed' then 'pending'
      when ${outcome}='failed' then case when attempts+1>=${MAX_ATTEMPTS} then 'failed' else 'pending' end
      else 'done' end,
    attempts=attempts+case when ${outcome}='failed' and coalesce(state->>'requestedAt','')=${lease.requestedAt} then 1 else 0 end,
    claimed_at=null,last_error=case when ${outcome}='failed' and coalesce(state->>'requestedAt','')=${lease.requestedAt} then 'Could not prepare Lore for About' else null end,updated_at=now()
  where id=${lease.jobId}::uuid and artist_id=${artistId}::uuid and kind='lore_refresh'
    and status='running' and claimed_at=${lease.claimedAt}::timestamptz
  returning status
 `),
  ) as { status: string }[];
  return rows[0]?.status === "done";
}

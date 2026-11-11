import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import type { TransactionDb } from "@/lib/ownership/types";
import type { AboutLoreLease } from "@/lib/bio/types";

/** Lock and validate the request's exact lease and source-change marker before publishing Lore. */
export async function assertLoreRefreshLease(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  lease: AboutLoreLease,
): Promise<void> {
  const rows = rowsOf(
    await tx.execute(sql`
  select id from artist_research_jobs where id=${lease.jobId}::uuid and artist_id=${artistId}::uuid
   and kind='lore_refresh' and status='running' and claimed_at=${lease.claimedAt}::timestamptz
   and coalesce(state->>'requestedAt','')=${lease.requestedAt} for update
 `),
  );
  if (!rows.length) throw new LoreChangedError();
}

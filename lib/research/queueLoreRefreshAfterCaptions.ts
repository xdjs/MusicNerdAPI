import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import type { TransactionDb } from "@/lib/ownership/types";
import { queueLoreRefreshInTransaction } from "@/lib/research/queueLoreRefreshInTransaction";
import type { ResearchJob } from "@/lib/research/types";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";

/**
 * Queues a first Lore document under the same artist/job guard as the caption
 * write. The marker and the Lore request commit together: a killed caption
 * tail can retry without creating another rebuild or another social scrape.
 */
export async function queueLoreRefreshAfterCaptions(job: ResearchJob): Promise<boolean> {
  return withResearchJobWrite(job.artistId, job.id, async tx => {
    // withResearchJobWrite passes the full transaction; its public type exposes
    // only the write methods needed by most callers.
    const transaction = tx as TransactionDb;
    const rows = rowsOf(
      await tx.execute(sql`
      select state from artist_research_jobs
       where id = ${job.id}::uuid and artist_id = ${job.artistId}::uuid
         and kind = 'caption_extract' and status in ('pending', 'running')
       for update`),
    );
    const current = rows[0] as { state?: Record<string, unknown> } | undefined;
    if (!current || current.state?.loreRefreshQueued === true) return false;
    const claim = await findApprovedClaim(transaction, job.artistId);
    await queueLoreRefreshInTransaction(transaction, job.artistId, claim?.id ?? null);
    await tx.execute(sql`
      update artist_research_jobs
         set state = jsonb_set(coalesce(state, '{}'::jsonb), '{loreRefreshQueued}', 'true'::jsonb),
             updated_at = now()
       where id = ${job.id}::uuid`);
    return true;
  });
}

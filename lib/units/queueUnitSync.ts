import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";

/**
 * Queue a `unit_sync` job that indexes the artist's sources that have no units yet.
 *
 * @param artistId - The artist whose sources need indexing.
 * @param writer - An open transaction to insert within; the pool is used when omitted.
 * @returns True when a job was queued, false when one is already pending or running.
 */
export async function queueUnitSync(artistId: string, writer?: TransactionDb): Promise<boolean> {
  const result = await (writer ?? db).execute(sql`
      insert into artist_research_jobs (artist_id, kind, status)
      values (${artistId}::uuid, 'unit_sync', 'pending')
      on conflict (artist_id, kind) where status in ('pending', 'running') do nothing
      returning id`);
  return rowsOf(result).length > 0;
}

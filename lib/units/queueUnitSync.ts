import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";

/**
 * Queue a `unit_sync` job that brings the artist's text index in line with their sources.
 *
 * When a job is already pending or running, it is asked to rescan instead (`state.rescan`): a
 * running job resumes after its saved key, so a new source sorting before that key would otherwise
 * be skipped, and no later job would come for it.
 *
 * @param artistId - The artist whose sources need indexing.
 * @param writer - An open transaction to insert within; the pool is used when omitted.
 * @returns True when a job was queued, false when a live one was asked to rescan.
 */
export async function queueUnitSync(artistId: string, writer?: TransactionDb): Promise<boolean> {
  const result = await (writer ?? db).execute(sql`
      insert into artist_research_jobs (artist_id, kind, status)
      values (${artistId}::uuid, 'unit_sync', 'pending')
      on conflict (artist_id, kind) where status in ('pending', 'running')
      do update set state = coalesce(artist_research_jobs.state, '{}'::jsonb) || '{"rescan":true}'::jsonb
      returning (xmax = 0) as inserted`);
  const [row] = rowsOf(result) as { inserted?: boolean }[];
  return row?.inserted === true;
}

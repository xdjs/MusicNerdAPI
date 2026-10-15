import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { ResearchJob } from "@/lib/research/types";

/** Checkpoint one lease atomically. Cooldown observations do not reset or consume the failure budget. */
export async function saveSpotifyMatchProgress(
  job: ResearchJob,
  state: Record<string, unknown>,
  options: { status?: "pending" | "done" | "failed"; failure?: boolean; error?: string } = {},
  writer: Pick<typeof db, "execute"> = db,
): Promise<boolean> {
  const result = await writer.execute(sql`
    update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,
      status=${options.status ?? "pending"}, claimed_at=null, updated_at=clock_timestamp(),
      attempts=attempts+${options.failure ? 1 : 0}, last_error=${options.error?.slice(0, 500) ?? null}
    where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='spotify_match'
      and status='running' and updated_at=${job.updatedAt}::timestamptz
      and coalesce(state->>'identityChanged','false')<>'true'
    returning id
  `);
  return rowsOf(result).length > 0;
}

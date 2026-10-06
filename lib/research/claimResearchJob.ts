import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { LEASE_MS, MAX_ATTEMPTS } from "@/lib/research/const";
import { toResearchJob } from "@/lib/research/toResearchJob";
import type { JobKind, ResearchJob } from "@/lib/research/types";

/**
 * Takes one job, atomically: the claim and the read are one statement, so two
 * invocations can never both own the same job, and a claim that is never
 * released expires with its lease instead of wedging. Claiming does not count
 * as an attempt; `attempts` counts failures only, or a long feed would stall
 * after four slices. A job still `running` past its lease is the exception:
 * its last invocation was killed before it could record anything, and that
 * counts, or a job the platform kills every time is retried forever. Automatic
 * source backlog enters the existing live slot only after prior extraction finishes.
 *
 * @param opts - Which kinds to take, optionally one artist, and jobs this tick already touched.
 * @param opts.kinds - The job kinds this caller can run.
 * @param opts.artistId - Only this artist's jobs.
 * @param opts.excludeIds - Jobs to skip, such as a scrape this tick already polled.
 * @returns The claimed job, or null when there is nothing to do or the query failed.
 */
export async function claimResearchJob(opts: {
  kinds: JobKind[];
  artistId?: string;
  excludeIds?: string[];
}): Promise<ResearchJob | null> {
  try {
    const kinds = sql.join(
      opts.kinds.map(kind => sql`${kind}`),
      sql`, `,
    );
    const scope = opts.artistId ? sql`and artist_id = ${opts.artistId}::uuid` : sql``;
    const skip = opts.excludeIds?.length
      ? sql`and id not in (${sql.join(
          opts.excludeIds.map(id => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql``;
    const rows = await db.execute(sql`
      update artist_research_jobs
         set status = 'running', claimed_at = now(), updated_at = now(),
             attempts = attempts + case when status = 'running' then 1 else 0 end
       where id = (
         select candidate.id from artist_research_jobs candidate
          where (candidate.status in ('pending', 'running') or (
            candidate.status = 'queued' and candidate.kind = 'source_extract'
            and candidate.state->>'version' = '2'
            and not exists (
              select 1 from artist_research_jobs live
               where live.artist_id = candidate.artist_id and live.kind = 'source_extract'
                 and live.status in ('pending','running')
            )
          ))
            and attempts < ${MAX_ATTEMPTS}
            and (claimed_at is null or claimed_at < now() - ${`${LEASE_MS} milliseconds`}::interval)
            and kind in (${kinds})
            ${scope}
            ${skip}
          order by created_at
          limit 1
          for update skip locked
       )
      returning *, updated_at::text as lease_updated_at`);
    const row = (rows as unknown as Record<string, unknown>[])[0];
    return row ? toResearchJob(row) : null;
  } catch (e) {
    // Two queued sources may race for the artist's existing live slot. The
    // unique index rolls the loser back to queued; a later tick can claim it.
    const error = e as { code?: string; cause?: { code?: string } };
    if (error?.code === "23505" || error?.cause?.code === "23505") return null;
    console.error("[claimResearchJob] Error:", e);
    return null;
  }
}

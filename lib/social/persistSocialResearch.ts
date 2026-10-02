import { sql } from "drizzle-orm";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";

/** Persists paid-run state under the revocation guard and propagates failures; optionally releases the lease. */
export async function persistSocialResearch(
  job: { id: string; artistId: string; state: Record<string, unknown> },
  release: boolean,
): Promise<void> {
  await withResearchJobWrite(job.artistId, job.id, async tx => {
    await tx.execute(sql`update artist_research_jobs set state = ${JSON.stringify(job.state)}::jsonb,
      status = ${release ? "pending" : "running"},
      claimed_at = ${release ? sql`null` : sql`now()`},
      attempts = ${release ? sql`0` : sql`attempts`}, updated_at = now()
      where id = ${job.id}::uuid and artist_id = ${job.artistId}::uuid`);
  });
}

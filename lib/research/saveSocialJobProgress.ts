import { sql } from "drizzle-orm";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import type { ResearchJob } from "@/lib/research/types";
/** Directory descendants cannot resurrect a retired job by releasing stale progress. */
export async function saveSocialJobProgress(
  job: ResearchJob,
  cursor: number,
  opts?: { total?: number | null; state?: Record<string, unknown> },
): Promise<void> {
  if (!("directoryActivityId" in job.state) && !("resumedFromDirectoryJobId" in job.state))
    return saveJobProgress(job.id, cursor, opts);
  await withResearchJobWrite(job.artistId, job.id, async tx => {
    await tx.execute(
      sql`update artist_research_jobs set cursor=${cursor},status='pending',claimed_at=null,attempts=0,total=coalesce(${opts?.total ?? null},total),state=coalesce(${opts?.state ? JSON.stringify(opts.state) : null}::jsonb,state),updated_at=now() where id=${job.id}::uuid`,
    );
  });
}

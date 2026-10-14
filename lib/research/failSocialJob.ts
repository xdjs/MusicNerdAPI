import { sql } from "drizzle-orm";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { failJobAtCursor } from "@/lib/research/failJobAtCursor";
import { MAX_ATTEMPTS } from "@/lib/research/const";
import type { ResearchJob } from "@/lib/research/types";
/** Keep retry metadata inside the same authority guard as social content and paid progress. */
export async function failSocialJob(
  job: ResearchJob,
  error: string,
  progress?: { cursor: number; total: number | null; state: Record<string, unknown> },
): Promise<void> {
  if (!("directoryActivityId" in job.state) && !("resumedFromDirectoryJobId" in job.state)) {
    if (progress)
      return failJobAtCursor(job.id, progress.cursor, progress.total, progress.state, error);
    return failResearchJob(job.id, error);
  }
  await withResearchJobWrite(job.artistId, job.id, async tx => {
    await tx.execute(
      sql`update artist_research_jobs set cursor=coalesce(${progress?.cursor ?? null},cursor),total=coalesce(${progress?.total ?? null},total),state=coalesce(${progress ? JSON.stringify(progress.state) : null}::jsonb,state),attempts=attempts+1,status=case when attempts+1>=${MAX_ATTEMPTS} then 'failed' else 'pending' end,claimed_at=null,last_error=${error.slice(0, 500)},updated_at=now() where id=${job.id}::uuid`,
    );
  });
}

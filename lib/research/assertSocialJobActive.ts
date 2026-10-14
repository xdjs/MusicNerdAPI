import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import type { ResearchJob } from "@/lib/research/types";
/** Recheck directory/claim authority immediately before paid work and after external awaits. */
export async function assertSocialJobActive(job: ResearchJob): Promise<void> {
  if ("directoryActivityId" in job.state || "resumedFromDirectoryJobId" in job.state)
    await withResearchJobWrite(job.artistId, job.id, async () => undefined);
}

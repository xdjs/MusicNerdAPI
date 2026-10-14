import { saveJobState } from "@/lib/research/saveJobState";
import { persistSocialResearch } from "@/lib/social/persistSocialResearch";
import type { ResearchJob } from "@/lib/research/types";
/** Keep authority checks on directory and resumed state without releasing a live lease. */
export async function saveSocialJobState(
  job: ResearchJob,
  state: Record<string, unknown>,
): Promise<void> {
  if ("directoryActivityId" in job.state || "resumedFromDirectoryJobId" in job.state)
    await persistSocialResearch({ ...job, state }, false);
  else await saveJobState(job.id, state);
}

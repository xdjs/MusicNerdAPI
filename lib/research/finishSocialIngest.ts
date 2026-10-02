import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { enqueueResearchJob } from "@/lib/research/enqueueResearchJob";
import { saveJobState } from "@/lib/research/saveJobState";
import { runAdditionalSocialResearch } from "@/lib/social/runAdditionalSocialResearch";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import type { AdditionalSocialState } from "@/lib/social/types";

/** Completes Instagram, then additional sources, before handing all stored captions to extraction. */
export async function finishSocialIngest(
  job: ResearchJob,
  deadline: number,
  progress: string,
): Promise<SliceOutcome> {
  const outcome = await runAdditionalSocialResearch(job, deadline);
  if (outcome) return outcome;
  await saveJobState(job.id, job.state);
  await completeResearchJob(job.id);
  const additional = job.state.additionalSocial as AdditionalSocialState | undefined;
  const newAudio = additional?.tasks.some(
    task => task.source === "reels" && (task.stored ?? 0) > 0,
  );
  await enqueueResearchJob(job.artistId, "caption_extract", {
    parentJobId: job.id,
    state: {
      ...(job.state.force === true ? { incremental: true } : {}),
      ...(newAudio ? { rebuildForVideoContext: true } : {}),
    },
  });
  return { progress, done: true };
}

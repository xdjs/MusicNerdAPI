import { runQuestionResearch } from "@/lib/questionResearch/runQuestionResearch";
import { runSourceExtraction } from "@/lib/sourceExtraction/runSourceExtraction";
import { runLatestRefresh } from "@/lib/latest/runLatestRefresh";
import { runCaptionExtract } from "@/lib/research/runCaptionExtract";
import { runIngest } from "@/lib/research/runIngest";
import { runLoreRefresh } from "@/lib/research/runLoreRefresh";
import { runSourceSearchJob } from "@/lib/research/runSourceSearchJob";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * Runs one slice of a claimed job with the runner for its kind.
 *
 * @param job - The claimed job.
 * @param deadline - When the slice must stop, in epoch milliseconds.
 * @returns What the slice did.
 */
export async function runResearchJob(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  switch (job.kind) {
    case "question_research":
      return runQuestionResearch(job, deadline);
    case "source_extract":
      return runSourceExtraction(job, deadline);
    case "caption_extract":
      return runCaptionExtract(job, deadline);
    case "lore_refresh":
      return runLoreRefresh(job, deadline);
    case "social_ingest":
      return runIngest(job, deadline);
    case "source_search":
      return runSourceSearchJob(job, deadline);
    case "latest_refresh":
      return runLatestRefresh(job, deadline);
  }
}

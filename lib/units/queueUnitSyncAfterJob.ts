import type { JobKind, ResearchJob, SliceOutcome } from "@/lib/research/types";
import { queueUnitSync } from "@/lib/units/queueUnitSync";

/** Research jobs whose completion can leave text the index does not hold yet (Ruling R15). */
const TEXT_PRODUCING_KINDS: ReadonlySet<JobKind> = new Set<JobKind>([
  "source_extract",
  "social_ingest",
  "caption_extract",
  "question_research",
  "lore_refresh",
]);

/**
 * After a slice, queue a `unit_sync` for the artist when a text-producing research job has just
 * finished, so the text it wrote is indexed (or a live sync rescans for it). Called outside any job
 * transaction, after the runner returned.
 *
 * @param job - The job the slice ran.
 * @param outcome - What the slice reported.
 * @returns Nothing; never rejects: a failure is logged by name only.
 */
export async function queueUnitSyncAfterJob(
  job: ResearchJob,
  outcome: SliceOutcome,
): Promise<void> {
  if (!outcome.done || !TEXT_PRODUCING_KINDS.has(job.kind)) return;
  try {
    await queueUnitSync(job.artistId);
  } catch (error) {
    // The name only: a failed query's message carries its bound parameters.
    console.warn(
      `[unit_sync] Could not queue after ${job.kind} job ${job.id}: ${error instanceof Error ? error.name : "unknown"}`,
    );
  }
}

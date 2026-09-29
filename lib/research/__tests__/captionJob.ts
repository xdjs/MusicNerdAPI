import type { ResearchJob } from "@/lib/research/types";

/**
 * A claimed caption_extract job, for fixtures.
 *
 * @param state - The job's state.
 * @param cursor - The job's cursor.
 * @returns The job.
 */
export function captionJob(state: Record<string, unknown> = {}, cursor = 0): ResearchJob {
  return {
    id: "job-1",
    artistId: "artist-1",
    kind: "caption_extract",
    status: "running",
    cursor,
    total: null,
    attempts: 0,
    state,
    updatedAt: null,
  };
}

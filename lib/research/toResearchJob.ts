import type { JobKind, JobStatus, ResearchJob } from "@/lib/research/types";

/**
 * Maps a raw `artist_research_jobs` row (snake_case, from `db.execute`) to a job.
 *
 * @param row - The row as Postgres returned it.
 * @returns The job.
 */
export function toResearchJob(row: Record<string, unknown>): ResearchJob {
  const updatedAt = row.updated_at ?? row.updatedAt;
  return {
    id: String(row.id),
    artistId: String(row.artist_id ?? row.artistId),
    kind: String(row.kind) as JobKind,
    status: String(row.status) as JobStatus,
    cursor: Number(row.cursor ?? 0),
    total: row.total === null || row.total === undefined ? null : Number(row.total),
    attempts: Number(row.attempts ?? 0),
    state: (row.state as Record<string, unknown>) ?? {},
    updatedAt: updatedAt ? String(updatedAt) : null,
  };
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import type { ResearchJob } from "@/lib/research/types";
import type { PreparationState } from "./preparationTypes";
/** Exact lease fencing; replaced or expired workers cannot checkpoint a candidate. */
export async function checkpointPreparationJob(
  job: ResearchJob,
  state: PreparationState,
  release: boolean,
) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    const terminal = ["ready", "failed", "stale"].includes(state.stage);
    const [saved] = await tx.execute<{ updated_at: string }>(
      sql`update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,status=${terminal ? (state.stage === "ready" ? "done" : "failed") : release ? "pending" : "running"},claimed_at=${terminal || release ? sql`null` : sql`now()`},attempts=${release && !state.inFlight ? sql`0` : sql`attempts`},updated_at=clock_timestamp(),last_error=${state.errorCode ?? null} where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='interview_prepare' and status='running' and updated_at is not distinct from ${job.updatedAt}::timestamptz returning updated_at::text`,
    );
    if (saved) job.updatedAt = saved.updated_at;
    return !!saved;
  });
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { ResearchJob } from "@/lib/research/types";
import type { TransactionDb } from "@/lib/ownership/types";
import type { QuestionResearchState } from "@/lib/questionResearch/types";

/** Lease-fenced, ownership-checked checkpoint; a reservation must commit before external work. */
export async function checkpointQuestionResearch(
  job: ResearchJob,
  state: QuestionResearchState,
  release = true,
  write?: (tx: TransactionDb) => Promise<void>,
): Promise<boolean> {
  const committed = await db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    const claim = await findApprovedClaim(tx, job.artistId);
    if ((claim?.id ?? null) !== state.expectedClaimId) throw new OwnershipChangedError();
    const live = await tx.execute(
      sql`select id from artist_research_jobs where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='question_research' and status='running' and updated_at is not distinct from ${job.updatedAt}::timestamptz for update`,
    );
    if (!live.length) return null;
    if (write) await write(tx);
    const terminal = ["complete", "unresolved", "failed", "cancelled"].includes(state.stage);
    const [saved] = await tx.execute<{ updated_at: string }>(
      sql`update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,status=${terminal ? (state.stage === "failed" ? "failed" : "done") : release ? "pending" : "running"},claimed_at=${terminal || release ? sql`null` : sql`now()`},updated_at=clock_timestamp(),attempts=0,last_error=${state.errorCode ?? null} where id=${job.id}::uuid returning updated_at::text as updated_at`,
    );
    if (!saved) throw new Error("Research checkpoint unavailable");
    return saved.updated_at;
  });
  if (!committed) return false;
  job.updatedAt = committed;
  job.state = state as unknown as Record<string, unknown>;
  return true;
}

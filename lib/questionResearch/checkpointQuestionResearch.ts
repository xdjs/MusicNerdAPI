import { getQuestionResearchBudget } from "./getQuestionResearchBudget";
import { ResearchQuotaError } from "./ResearchQuotaError";
import { parseQuestionResearchState } from "./parseQuestionResearchState";
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
  reserveOutside = false,
): Promise<boolean> {
  const committed = await db.transaction(async tx => {
    if (reserveOutside)
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('musicnerd-question-research-budget'))`,
      );
    await lockArtistRow(tx, job.artistId);
    const claim = await findApprovedClaim(tx, job.artistId);
    if ((claim?.id ?? null) !== state.expectedClaimId) throw new OwnershipChangedError();
    const live = await tx.execute<{ id: string; state: unknown }>(
      sql`select id,state from artist_research_jobs where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='question_research' and status='running' and updated_at is not distinct from ${job.updatedAt}::timestamptz for update`,
    );
    if (!live.length) return null;
    let outsideReservedAt: string | undefined;
    if (reserveOutside) {
      const persisted = parseQuestionResearchState(live[0].state);
      if (
        state.budgetVersion !== 2 ||
        persisted.budgetVersion !== 2 ||
        state.savedOnly ||
        persisted.savedOnly
      )
        throw new Error("Invalid outside research reservation");
      outsideReservedAt = persisted.outsideReservedAt;
      if (!outsideReservedAt) {
        const budget = await getQuestionResearchBudget(tx, job.artistId);
        if (budget.outside) throw new ResearchQuotaError(budget.outside);
        outsideReservedAt = budget.checkedAt;
      }
    }
    if (write) await write(tx);
    const terminal = ["complete", "unresolved", "failed", "cancelled"].includes(state.stage);
    const [saved] = await tx.execute<{ updated_at: string }>(
      sql`update artist_research_jobs set state=${JSON.stringify(outsideReservedAt ? { ...state, outsideReservedAt } : state)}::jsonb,status=${terminal ? (state.stage === "failed" ? "failed" : "done") : release ? "pending" : "running"},claimed_at=${terminal || release ? sql`null` : sql`now()`},updated_at=clock_timestamp(),attempts=0,last_error=${state.errorCode ?? null} where id=${job.id}::uuid returning updated_at::text as updated_at`,
    );
    if (!saved) throw new Error("Research checkpoint unavailable");
    return { updatedAt: saved.updated_at, outsideReservedAt };
  });
  if (!committed) return false;
  job.updatedAt = committed.updatedAt;
  if (committed.outsideReservedAt) state.outsideReservedAt = committed.outsideReservedAt;
  job.state = state as unknown as Record<string, unknown>;
  return true;
}

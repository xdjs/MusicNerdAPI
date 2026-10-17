import { sql } from "drizzle-orm";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { TransactionDb } from "@/lib/ownership/types";
import { readPreparationScope } from "./readPreparationScope";
import { parsePreparationState } from "./parsePreparationState";
import type { PreparationState } from "./preparationTypes";
/** Enqueue under the artist lock, deduplicating a session/ordinal/memory revision before paid work. */
export async function queueInterviewPreparationInTransaction(
  tx: TransactionDb,
  artistId: string,
  userId: string,
  sessionId: string,
) {
  await lockArtistRow(tx, artistId);
  const scope = await readPreparationScope(tx, artistId, userId, sessionId);
  if (scope.session.questions.some(q => q.state === "offered") || scope.ordinal > 3)
    throw new KnowledgeError(
      "preparation_stale",
      409,
      "Restore the saved question before preparing another.",
    );
  const jobs = await tx.execute<{ id: string; status: string; state: unknown }>(
    sql`select id,status,state from artist_research_jobs where artist_id=${artistId}::uuid and kind='interview_prepare' order by created_at desc limit 10`,
  );
  for (const job of jobs) {
    const state = parsePreparationState(job.state);
    if (
      state.claimId === scope.claimId &&
      state.userId === userId &&
      state.sessionId === sessionId &&
      state.bankComplete &&
      state.bank?.some(item => item.status === "available") &&
      (state.memorySnapshotId !== scope.memorySnapshotId || state.ordinal !== scope.ordinal)
    ) {
      state.ordinal = scope.ordinal;
      state.memorySnapshotId = scope.memorySnapshotId;
      state.stage = "preparing";
      state.cache = {};
      state.inFlight = false;
      state.createdAt = new Date().toISOString();
      delete state.errorCode;
      await tx.execute(
        sql`update artist_research_jobs set status='pending',state=${JSON.stringify(state)}::jsonb,claimed_at=null,attempts=0,updated_at=clock_timestamp() where id=${job.id}::uuid`,
      );
      return {
        status: "ok" as const,
        preparation: {
          jobId: job.id,
          status: "pending" as const,
          readyCount: 0,
          totalCount: state.totalCount,
        },
      };
    }
    if (
      state.claimId === scope.claimId &&
      state.userId === userId &&
      state.sessionId === sessionId &&
      state.ordinal === scope.ordinal &&
      state.memorySnapshotId === scope.memorySnapshotId &&
      ["pending", "running", "done"].includes(job.status) &&
      !["failed", "stale", "consumed"].includes(state.stage)
    )
      return {
        status: "ok" as const,
        preparation: {
          jobId: job.id,
          readyCount:
            state.stage === "ready"
              ? (state.bank?.filter(item => item.status === "available").length ?? 1)
              : 0,
          totalCount: state.totalCount ?? 1,
          phase: state.bankComplete ? ("checking" as const) : ("preparing" as const),
          status:
            state.stage === "ready"
              ? ("ready" as const)
              : job.status === "running"
                ? ("running" as const)
                : ("pending" as const),
        },
      };
  }
  await tx.execute(
    sql`update artist_research_jobs set status='failed',state=jsonb_set(state,'{stage}','"stale"'),claimed_at=null,updated_at=clock_timestamp() where artist_id=${artistId}::uuid and kind='interview_prepare' and status in ('pending','running')`,
  );
  const state: PreparationState = {
    version: 1,
    totalCount: 4 - scope.ordinal,
    claimId: scope.claimId,
    userId,
    sessionId,
    sitting: scope.sitting,
    ordinal: scope.ordinal,
    memorySnapshotId: scope.memorySnapshotId,
    stage: "preparing",
    cache: {},
    inFlight: false,
    createdAt: new Date().toISOString(),
  };
  const [job] = await tx.execute<{ id: string }>(
    sql`insert into artist_research_jobs(artist_id,kind,status,state) values(${artistId}::uuid,'interview_prepare','pending',${JSON.stringify(state)}::jsonb) returning id`,
  );
  if (!job) throw new Error("Preparation queue unavailable");
  return { status: "ok" as const, preparation: { jobId: job.id, status: "pending" as const } };
}

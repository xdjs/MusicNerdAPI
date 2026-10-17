import { readInterviewSessionState } from "@/lib/interviewSessions/readInterviewSessionState";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeInterviewPreparation } from "./authorizeInterviewPreparation";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readPreparationScope } from "./readPreparationScope";
import { parsePreparationState } from "./parsePreparationState";
/** Report private preparation state without creating jobs, offers or model calls. */
export async function getInterviewPreparation(artistId: string, userId: string, sessionId: string) {
  return db.transaction(
    async tx => {
      const claimId = await authorizeInterviewPreparation(tx, artistId, userId);
      const [job] = await tx.execute<{ id: string; status: string; state: unknown }>(
        sql`select id,status,state from artist_research_jobs where artist_id=${artistId}::uuid and kind='interview_prepare' and state->>'sessionId'=${sessionId} and state->>'userId'=${userId} order by created_at desc limit 1`,
      );
      if (!job) return { status: "ok" as const, preparation: { status: "idle" as const } };
      const state = parsePreparationState(job.state);
      if (state.stage === "consumed")
        return { status: "ok" as const, preparation: { status: "idle" as const } };
      const { session } = await readInterviewSessionState(tx, artistId, sessionId);
      let stale =
        state.stage === "stale" ||
        claimId !== state.claimId ||
        !session ||
        session.state !== "active" ||
        session.questions.length + 1 !== state.ordinal ||
        session.questions.some(q => q.state === "offered");
      try {
        // Pending work revalidates memory before running. Only a ready candidate
        // needs a full memory read on poll; consume checks it again under lock.
        const scope =
          state.stage === "ready"
            ? await readPreparationScope(tx, artistId, userId, sessionId)
            : null;
        stale ||=
          !!scope &&
          (scope.claimId !== state.claimId ||
            scope.ordinal !== state.ordinal ||
            scope.memorySnapshotId !== state.memorySnapshotId ||
            scope.session.questions.some(q => q.state === "offered"));
      } catch (error) {
        if (error instanceof KnowledgeError && error.code === "preparation_stale") stale = true;
        else throw error;
      }
      const status = stale
        ? "stale"
        : state.stage === "ready"
          ? "ready"
          : state.stage === "failed" || job.status === "failed"
            ? "failed"
            : job.status === "running"
              ? "running"
              : "pending";
      return {
        status: "ok" as const,
        preparation: {
          jobId: job.id,
          status,
          ...(state.errorCode ? { errorCode: state.errorCode } : {}),
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

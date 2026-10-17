import { db } from "@/lib/db/db";
import { NoObjectGeneratedError } from "ai";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { readPreparationScope } from "./readPreparationScope";
import { parsePreparationState } from "./parsePreparationState";
import { checkpointPreparationJob } from "./checkpointPreparationJob";
import { generateApiInterviewQuestion } from "./generateApiInterviewQuestion";
import { InterviewStageComplete } from "./InterviewStageComplete";
/** Advance one durable model stage, preserving completed stages and fencing stale workers. */
export async function runInterviewPreparation(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome> {
  const state = parsePreparationState(job.state);
  const stale = { done: false, waiting: true, progress: "Preparation lease changed" };
  const finish = async (waiting = false) =>
    (await checkpointPreparationJob(job, state, true))
      ? {
          done: state.stage !== "preparing",
          waiting: state.stage === "preparing" && waiting,
          progress: state.stage,
        }
      : stale;
  try {
    const scope = await db.transaction(tx =>
      readPreparationScope(tx, job.artistId, state.userId, state.sessionId),
    );
    if (
      scope.claimId !== state.claimId ||
      scope.ordinal !== state.ordinal ||
      scope.memorySnapshotId !== state.memorySnapshotId ||
      scope.session.questions.some(q => q.state === "offered")
    ) {
      state.stage = "stale";
      return finish();
    }
    if (state.inFlight) {
      state.stage = "failed";
      state.errorCode = "external_outcome_unknown";
      return finish();
    }
    if (Date.now() - Date.parse(state.createdAt) > 30 * 60 * 1000) {
      state.stage = "failed";
      state.errorCode = "preparation_failed";
      return finish();
    }
    if (deadline - Date.now() < 12000) return finish(true);
    state.inFlight = true;
    if (!(await checkpointPreparationJob(job, state, false))) return stale;
    try {
      state.candidate = await generateApiInterviewQuestion(
        { artistId: job.artistId, userId: state.userId },
        state.sitting,
        AbortSignal.timeout(Math.max(1, deadline - Date.now() - 1500)),
        undefined,
        undefined,
        undefined,
        state.cache,
      );
      if (state.candidate.diagnostics)
        state.candidate.diagnostics.elapsedMs = Date.now() - Date.parse(state.createdAt);
      state.stage = "ready";
    } catch (error) {
      if (!(error instanceof InterviewStageComplete)) throw error;
    }
    state.inFlight = false;
    return finish();
  } catch (error) {
    state.inFlight = false;
    state.stage =
      error instanceof KnowledgeError && [401, 403, 409].includes(error.status)
        ? "stale"
        : "failed";
    state.errorCode = NoObjectGeneratedError.isInstance(error)
      ? "model_output_invalid"
      : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
        ? "timeout_or_cancelled"
        : "preparation_failed";
    return finish();
  }
}

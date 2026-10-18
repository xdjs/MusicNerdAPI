import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { saveInterviewOfferInTransaction } from "@/lib/interviewSessions/saveInterviewOfferInTransaction";
import { readPreparationScope } from "./readPreparationScope";
import { parsePreparationState } from "./parsePreparationState";
/** Only an explicit consume turns a checked candidate into an offer, against current memory. */
export async function consumeInterviewPreparation(
  artistId: string,
  userId: string,
  sessionId: string,
) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    const scope = await readPreparationScope(tx, artistId, userId, sessionId);
    const [job] = await tx.execute<{ id: string; state: unknown }>(
      sql`select id,state from artist_research_jobs where artist_id=${artistId}::uuid and kind='interview_prepare' and state->>'sessionId'=${sessionId} and state->>'userId'=${userId} order by created_at desc limit 1 for update`,
    );
    if (!job)
      throw new KnowledgeError("preparation_not_ready", 409, "The next question is not ready yet.");
    const state = parsePreparationState(job.state);
    if (state.interviewInvalidated)
      throw new KnowledgeError(
        "interview_invalidated",
        409,
        "Your instructions changed. Finish this sitting before preparing another.",
      );
    const offered = scope.session.questions.find(q => q.state === "offered");
    // Explicit Resume can upgrade a checked legacy bank without a new model call.
    // Merely offering its current question does not change mandatory memory.
    const upgradeLegacyBank =
      !!offered &&
      state.bankComplete &&
      !state.batchOffered &&
      state.stage === "consumed" &&
      state.ordinal === offered.ordinal &&
      scope.claimId === state.claimId &&
      scope.memorySnapshotId === state.memorySnapshotId &&
      state.bank?.some(item => item.status === "available");
    if (offered && scope.claimId === state.claimId && !upgradeLegacyBank)
      return { status: "ok" as const, question: offered, questions: scope.session.questions };
    if (state.stage === "consumed" && !upgradeLegacyBank) {
      const existing = scope.session.questions.find(q => q.ordinal === state.ordinal);
      if (existing)
        return { status: "ok" as const, question: existing, questions: scope.session.questions };
    }
    if (
      scope.claimId !== state.claimId ||
      (!upgradeLegacyBank && scope.ordinal !== state.ordinal) ||
      scope.memorySnapshotId !== state.memorySnapshotId ||
      state.stage === "stale"
    )
      throw new KnowledgeError(
        "preparation_stale",
        409,
        "Your interview changed. Prepare a fresh question.",
      );
    const item = state.bank?.find(item => item.status === "available");
    const candidate = item?.candidate ?? (!state.bank ? state.candidate : undefined);
    if ((!upgradeLegacyBank && state.stage !== "ready") || !candidate)
      throw new KnowledgeError("preparation_not_ready", 409, "The next question is not ready yet.");
    const questions = [...scope.session.questions];
    const candidates =
      state.bankComplete && state.bank
        ? state.bank.filter(item => item.status === "available")
        : [item ?? { candidate, status: "available" as const }];
    for (const [index, entry] of candidates.entries()) {
      const ordinal = (upgradeLegacyBank ? scope.ordinal : state.ordinal) + index;
      if (ordinal > 3)
        throw new KnowledgeError("preparation_stale", 409, "Interview bank exceeds this sitting.");
      const result = await saveInterviewOfferInTransaction(
        tx,
        artistId,
        userId,
        sessionId,
        {
          ordinal,
          question: entry.candidate.question,
          references: entry.candidate.references,
          memorySnapshotId: state.memorySnapshotId,
        },
        state.bankComplete ? state.memorySnapshotId : undefined,
      );
      questions.push(result.question);
      if (state.bank) {
        const saved = state.bank.find(item => item === entry)!;
        saved.status = "offered";
        saved.ordinal = ordinal;
        saved.answerId = result.question.id;
      }
    }
    state.batchOffered = !!state.bankComplete;
    state.stage = "consumed";
    await tx.execute(
      sql`update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,updated_at=clock_timestamp() where id=${job.id}::uuid`,
    );
    return {
      status: "ok" as const,
      question: questions.find(question => question.state === "offered")!,
      questions,
    };
  });
}

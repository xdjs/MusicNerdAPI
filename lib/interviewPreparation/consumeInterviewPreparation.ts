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
    if (state.stage === "consumed") {
      const existing = scope.session.questions.find(q => q.ordinal === state.ordinal);
      if (existing) return { status: "ok" as const, question: existing };
    }
    if (
      scope.claimId !== state.claimId ||
      scope.ordinal !== state.ordinal ||
      scope.memorySnapshotId !== state.memorySnapshotId ||
      state.stage === "stale"
    )
      throw new KnowledgeError(
        "preparation_stale",
        409,
        "Your interview changed. Prepare a fresh question.",
      );
    if (state.stage !== "ready" || !state.candidate)
      throw new KnowledgeError("preparation_not_ready", 409, "The next question is not ready yet.");
    const result = await saveInterviewOfferInTransaction(tx, artistId, userId, sessionId, {
      ordinal: state.ordinal,
      question: state.candidate.question,
      references: state.candidate.references,
      memorySnapshotId: state.memorySnapshotId,
    });
    await tx.execute(
      sql`update artist_research_jobs set state=jsonb_set(state,'{stage}','"consumed"'),updated_at=clock_timestamp() where id=${job.id}::uuid`,
    );
    return result;
  });
}

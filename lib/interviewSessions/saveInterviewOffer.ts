import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readInterviewMemorySnapshot } from "@/lib/interviewMemory/readInterviewMemorySnapshot";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
import { validateInterviewSessionBody } from "./validateInterviewSessionBody";
import { readInterviewSessionState } from "./readInterviewSessionState";
import { validateInterviewOfferReferences } from "./validateInterviewOfferReferences";
import { toInterviewQuestion } from "./toInterviewQuestion";
import type { QuestionRow } from "./types";
/** Commit a single exact offer only against the current memory and original evidence; duplicate ordinals converge. */
export async function saveInterviewOffer(
  artistId: string,
  userId: string,
  sessionId: string,
  body: unknown,
) {
  if (!z.uuid().safeParse(sessionId).success)
    throw new KnowledgeError("invalid_input", 400, "Invalid session");
  const input = validateInterviewSessionBody("offer", body);
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const { session } = await readInterviewSessionState(tx, artistId, sessionId);
    if (!session) throw new KnowledgeError("not_found", 404, "Interview unavailable");
    const previous = session.questions.find(q => q.ordinal === input.ordinal);
    if (previous) return { status: "ok" as const, question: previous };
    if (
      session.state !== "active" ||
      input.ordinal !== session.questions.length + 1 ||
      session.questions.some(q => q.state === "offered")
    )
      throw new KnowledgeError(
        "session_changed",
        409,
        "Restore the current interview before asking another question",
      );
    await validateInterviewOfferReferences(tx, artistId, userId, input.references);
    const memory = await readInterviewMemorySnapshot(tx, artistId, userId, session.sitting);
    if (pageInterviewMemory(memory, { maxChars: 20000 }).snapshotId !== input.memorySnapshotId)
      throw new KnowledgeError(
        "memory_changed",
        409,
        "Interview memory changed; prepare a fresh question",
      );
    const [saved] = await tx.execute<QuestionRow>(
      sql`insert into artist_interview_answers(artist_id,question_key,question,answer,source,sitting)values(${artistId}::uuid,${`api:${sessionId}:${input.ordinal}`},${input.question},null,'offered',${session.sitting})returning *`,
    );
    if (!saved) throw new Error("Offer was not persisted");
    await tx.execute(
      sql`insert into artist_interview_question_evidence(answer_id,artist_id,session_id,ordinal,memory_snapshot_id,evidence_references)values(${saved.id}::uuid,${artistId}::uuid,${sessionId}::uuid,${input.ordinal},${input.memorySnapshotId},${JSON.stringify(input.references)}::jsonb)`,
    );
    return {
      status: "ok" as const,
      question: toInterviewQuestion({
        ...saved,
        ordinal: input.ordinal,
        evidence_references: input.references,
      }),
    };
  });
}

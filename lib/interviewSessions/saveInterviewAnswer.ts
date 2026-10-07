import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { validateInterviewSessionBody } from "./validateInterviewSessionBody";
import { toInterviewQuestion } from "./toInterviewQuestion";
import type { QuestionRow } from "./types";
/** Preserve exact artist words and offer time, rejecting a stale overwrite from another client. */
export async function saveInterviewAnswer(
  artistId: string,
  userId: string,
  answerId: string,
  body: unknown,
) {
  if (!z.uuid().safeParse(answerId).success)
    throw new KnowledgeError("invalid_input", 400, "Invalid answer");
  const input = validateInterviewSessionBody("answer", body);
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const [row] = await tx.execute<QuestionRow & { session_state: string | null }>(
      sql`select a.*,e.ordinal,e.evidence_references,s.state as session_state from artist_interview_answers a left join artist_interview_question_evidence e on e.answer_id=a.id left join artist_interview_sessions s on s.id=e.session_id where a.artist_id=${artistId}::uuid and a.id=${answerId}::uuid for update of a`,
    );
    if (!row) throw new KnowledgeError("not_found", 404, "Offered question unavailable");
    const current = toInterviewQuestion(row);
    if (current.state !== "offered" && current.answer === input.answer)
      return { status: "ok" as const, question: current };
    if (
      current.state !== "offered" ||
      current.revision !== input.expectedRevision ||
      row.session_state === "finished"
    )
      throw new KnowledgeError(
        "answer_changed",
        409,
        "This answer changed; reload the saved interview",
      );
    const [saved] = await tx.execute<QuestionRow>(
      sql`update artist_interview_answers set answer=${input.answer},source=${input.answer === null ? "skipped" : "interview"},created_at=clock_timestamp() where id=${answerId}::uuid and artist_id=${artistId}::uuid returning *`,
    );
    if (!saved) throw new Error("Answer was not persisted");
    return {
      status: "ok" as const,
      question: toInterviewQuestion({
        ...saved,
        ordinal: row.ordinal,
        evidence_references: row.evidence_references,
      }),
    };
  });
}

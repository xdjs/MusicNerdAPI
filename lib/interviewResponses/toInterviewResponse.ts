import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { InterviewResponse, ResponseRow } from "./types";

/** Preserve exact wording and the same citation revision as shared knowledge history. */
export function toInterviewResponse(row: ResponseRow): InterviewResponse {
  if (typeof row.answer !== "string" || !row.answer.trim())
    throw new KnowledgeError("not_found", 404, "Saved response unavailable");
  if (row.answer.length > 50000 || row.question.length > 10000)
    throw new KnowledgeError(
      "response_too_large",
      413,
      "Saved response exceeds the supported size",
    );
  const snapshot = normalizeArtistKnowledge({
    artist: { id: row.artistId, name: "", bio: null },
    summary: null,
    vault: [],
    social: [],
    answers: [row],
    corrections: [],
    jobs: [],
  });
  const entry = snapshot.history[0];
  return {
    id: row.id,
    questionKey: row.questionKey,
    question: row.question,
    answer: row.answer,
    source: row.source,
    sitting: row.sitting,
    offeredAt: entry.offeredAt,
    answerUpdatedAt: entry.answerUpdatedAt,
    revision: entry.revision,
  };
}

import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import type { QuestionRow } from "./types";
/** Use the exact same answer revision as mandatory memory and optional history. */
export function toInterviewQuestion(row: QuestionRow) {
  const offeredAt = new Date(row.offered_at).toISOString(),
    answerUpdatedAt = new Date(row.created_at).toISOString();
  const history = normalizeArtistKnowledge({
    artist: { id: row.artist_id, name: null, bio: null },
    summary: null,
    vault: [],
    social: [],
    jobs: [],
    corrections: [],
    answers: [
      {
        id: row.id,
        artistId: row.artist_id,
        questionKey: row.question_key,
        question: row.question,
        answer: row.answer,
        source: row.source,
        sitting: row.sitting,
        offeredAt,
        createdAt: answerUpdatedAt,
      },
    ],
  }).history[0];
  if (!history) throw new Error("Interview answer unavailable");
  return {
    id: row.id,
    sitting: row.sitting ?? 1,
    questionKey: row.question_key,
    question: row.question,
    answer: row.answer,
    state:
      row.source === "offered"
        ? ("offered" as const)
        : row.answer === null
          ? ("skipped" as const)
          : ("answered" as const),
    revision: history.revision,
    offeredAt,
    answerUpdatedAt,
    ordinal: row.ordinal ?? null,
    references: row.evidence_references ?? [],
  };
}

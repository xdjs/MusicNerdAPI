import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import type { BoundaryRow } from "@/lib/interviewMemory/types";
/** Keep the instruction revision stable across retraction while retaining its exact origin. */
export function toInterviewBoundary(row: BoundaryRow) {
  const original = {
    id: row.id,
    wording: row.wording,
    scope: row.scope,
    sitting: row.sitting,
    questionKey: row.origin_question_key,
    question: row.origin_question,
    createdAt: new Date(row.created_at).toISOString(),
  };
  return {
    ...original,
    revision: knowledgeRevision(original),
    retractedAt: row.retracted_at ? new Date(row.retracted_at).toISOString() : null,
  };
}

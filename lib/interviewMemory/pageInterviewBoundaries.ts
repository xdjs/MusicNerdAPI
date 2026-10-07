import { knowledgeCursor } from "@/lib/knowledge/knowledgeCursor";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { toInterviewBoundary } from "@/lib/interviewMemory/toInterviewBoundary";
/** Page whole exact instructions, independently of mandatory model-memory budgets. */
export function pageInterviewBoundaries(
  snapshot: {
    artistId: string;
    sitting: number;
    boundaries: ReturnType<typeof toInterviewBoundary>[];
  },
  continuation?: string,
) {
  const cursor = knowledgeCursor(
    [
      "active_boundaries",
      snapshot.artistId,
      snapshot.sitting,
      snapshot.boundaries.map(b => [b.id, b.revision]),
    ],
    continuation,
  );
  const [start, field, offset] = cursor.position;
  if (start > snapshot.boundaries.length || field !== 0 || offset !== 0)
    throw new KnowledgeError("invalid_input", 400, "Invalid boundary cursor");
  const boundaries = snapshot.boundaries.slice(start, start + 5);
  const next = start + boundaries.length;
  return {
    status: "ok" as const,
    sitting: snapshot.sitting,
    boundaries,
    nextCursor: next < snapshot.boundaries.length ? cursor.encode([next, 0, 0]) : null,
  };
}

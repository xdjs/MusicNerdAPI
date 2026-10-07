import { knowledgeCursor } from "@/lib/knowledge/knowledgeCursor";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { ResponseQuery } from "./types";

/** Bind small UI pages to their artist, operation and exact stored revisions. */
export function pageInterviewResponses<T>(rows: T[], scope: unknown, query: ResponseQuery) {
  const cursor = knowledgeCursor([scope, rows], query.cursor);
  const [offset, field, textOffset] = cursor.position;
  if (offset > rows.length || field !== 0 || textOffset !== 0)
    throw new KnowledgeError("invalid_input", 400, "Invalid response cursor");
  const end = Math.min(rows.length, offset + (query.limit ?? 10));
  return {
    items: rows.slice(offset, end),
    nextCursor: end < rows.length ? cursor.encode([end, 0, 0]) : null,
  };
}

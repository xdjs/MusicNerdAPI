import { knowledgeCursor } from "@/lib/knowledge/knowledgeCursor";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { MemoryEntry, MemorySnapshot } from "@/lib/interviewMemory/types";
/** Page mandatory exact fields without relevance filtering or silent truncation. */
export function pageInterviewMemory(
  snapshot: MemorySnapshot,
  query: { maxChars: number; cursor?: string },
) {
  if (!Number.isInteger(query.maxChars) || query.maxChars < 1000 || query.maxChars > 20000)
    throw new KnowledgeError("invalid_input", 400, "Invalid memory budget");
  const selected = snapshot.entries;
  const context = [snapshot.artistId, snapshot.sitting, selected.map(e => [e.entryId, e.revision])];
  const cursor = knowledgeCursor(context, query.cursor);
  let [row, field, offset] = cursor.position;
  if (
    row > selected.length ||
    (row === selected.length && (field !== 0 || offset !== 0)) ||
    (row < selected.length &&
      (field >= selected[row].fields.length || offset > selected[row].fields[field].totalChars))
  )
    throw new KnowledgeError("invalid_input", 400, "Invalid memory cursor");
  const entries: MemoryEntry[] = [];
  let returnedChars = 0;
  while (row < selected.length && entries.length < 50) {
    const original = selected[row];
    const fields: MemoryEntry["fields"] = [];
    while (field < original.fields.length) {
      const source = original.fields[field];
      const remaining = query.maxChars - returnedChars;
      if (remaining < 2 && offset < source.totalChars) break;
      const window = knowledgeWindow(source.text ?? "", offset, Math.max(2, remaining));
      if (window.start !== offset)
        throw new KnowledgeError("invalid_input", 400, "Invalid memory cursor offset");
      const complete = window.end === source.totalChars;
      fields.push({
        ...source,
        ...window,
        text: source.text === null ? null : window.text,
        complete,
      });
      returnedChars += window.text.length;
      if (!complete) {
        offset = window.end;
        break;
      }
      field++;
      offset = 0;
    }
    if (fields.length) entries.push({ ...original, fields });
    if (field < original.fields.length) break;
    row++;
    field = 0;
    offset = 0;
  }
  const latest = selected.find(e => e.kind === "latest_answer");
  const nextCursor = row < selected.length ? cursor.encode([row, field, offset]) : null;
  return {
    status: "ok" as const,
    snapshotId: knowledgeRevision(context),
    sitting: snapshot.sitting,
    latestAnswer: latest ? { entryId: latest.entryId, revision: latest.revision } : null,
    totalEntries: selected.length,
    entries,
    constraintsComplete: !query.cursor && nextCursor === null,
    budget: { returnedChars, nextCursor },
  };
}

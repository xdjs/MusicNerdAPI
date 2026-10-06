import { knowledgeCursor } from "@/lib/knowledge/knowledgeCursor";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type {
  HistoryEntry,
  KnowledgeQuery,
  KnowledgeResults,
  KnowledgeSnapshot,
} from "@/lib/knowledge/types";

/** Continues exact fields before advancing to another entry; corrections lead. */
export function getArtistKnowledgeHistory(
  snapshot: KnowledgeSnapshot,
  query: Extract<KnowledgeQuery, { operation: "history" }>,
): KnowledgeResults["history"] {
  const selected = snapshot.history.filter(entry =>
    entry.kind === "correction"
      ? query.kind !== "answers"
      : query.kind !== "corrections" &&
        (query.sitting === undefined || entry.sitting === query.sitting),
  );
  const cursor = knowledgeCursor(
    [
      snapshot.artist.id,
      query.operation,
      query.kind,
      query.sitting ?? null,
      selected.map(e => [e.entryId, e.revision]),
      snapshot.latestAnswer,
    ],
    query.cursor,
  );
  let [row, field, offset] = cursor.position;
  if (
    row > selected.length ||
    (row === selected.length && (field !== 0 || offset !== 0)) ||
    (row < selected.length &&
      (field >= selected[row].fields.length || offset > selected[row].fields[field].totalChars))
  )
    throw new KnowledgeError("invalid_input", 400, "Invalid history cursor position");
  const entries: HistoryEntry[] = [];
  let returnedChars = 0;
  while (row < selected.length && entries.length < query.limit) {
    const original = selected[row];
    const fields: HistoryEntry["fields"] = [];
    while (field < original.fields.length) {
      const source = original.fields[field];
      const remaining = query.maxChars - returnedChars;
      if (remaining < 2 && offset < source.totalChars) break;
      const window = knowledgeWindow(source.text ?? "", offset, Math.max(2, remaining));
      // A caller may not use a forged cursor to resume in a surrogate pair.
      if (window.start !== offset)
        throw new KnowledgeError("invalid_input", 400, "Invalid history cursor position");
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
  const nextCursor = row < selected.length ? cursor.encode([row, field, offset]) : null;
  const allCorrections = snapshot.history.filter(e => e.kind === "correction").length;
  return {
    status: "ok",
    entries,
    budget: { returnedChars, truncated: nextCursor !== null, nextCursor },
    constraintsComplete: false,
    memory: { boundaryState: "not_implemented", latestAnswer: snapshot.latestAnswer },
    correctionsComplete:
      allCorrections === 0 || (query.kind !== "answers" && row >= allCorrections),
  };
}

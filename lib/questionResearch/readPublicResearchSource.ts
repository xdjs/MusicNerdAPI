import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
/** Read only current public evidence; private uploads/history never enter this scope. */
export async function readPublicResearchSource(
  artistId: string,
  sourceId: string,
  revision: string,
  start: number,
  maxChars: number,
) {
  const originals = await loadPublicResearchOriginals(artistId);
  const original = originals.find(s => s.sourceId === sourceId);
  if (!original) throw new KnowledgeError("not_found", 404, "Original unavailable");
  if (original.revision !== revision)
    throw new KnowledgeError(
      "revision_changed",
      409,
      "Original changed; retrieve current evidence before answering",
    );
  if (start > original.text.length)
    throw new KnowledgeError("invalid_request", 400, "Original offset is outside the text");
  const window = knowledgeWindow(original.text, start, maxChars);
  return {
    status: "ok" as const,
    passage: { ...original, ...window },
    totalChars: original.text.length,
    nextStart: window.end < original.text.length ? window.end : null,
  };
}

import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { MAX_KNOWLEDGE_BYTES } from "@/lib/knowledge/types";
import type {
  Evidence,
  KnowledgeQuery,
  KnowledgeResults,
  SourceReadVersion,
} from "@/lib/knowledge/types";

/** Returns a bounded exact window, optionally labelling historical evidence for new clients. */
export function readKnowledgePassage(
  source: Evidence,
  query: Extract<KnowledgeQuery, { operation: "read" }>,
  version: SourceReadVersion = {
    state: "current",
    currentRevision: source.metadata.revision,
    capturedAt: null,
  },
): KnowledgeResults["read"] {
  if (source.metadata.sourceId !== query.sourceId || source.metadata.revision !== query.revision)
    throw new KnowledgeError(
      "revision_changed",
      409,
      "Source revision changed; reload its metadata",
    );
  const window = knowledgeWindow(source.text, query.start, query.maxChars);
  const nextStart = window.end < source.text.length ? window.end : null;
  const result: KnowledgeResults["read"] = {
    status: "ok",
    passage: {
      source: source.metadata,
      revision: source.metadata.revision,
      ...window,
      page: null,
      startSeconds: null,
      endSeconds: null,
    },
    totalChars: source.text.length,
    nextStart,
    returnedChars: window.text.length,
    truncated: nextStart !== null,
    ...(query.includeVersion ? { version } : {}),
  };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_KNOWLEDGE_BYTES)
    throw new KnowledgeError(
      "response_too_large",
      413,
      "Knowledge response exceeds its byte budget; request fewer characters",
    );
  return result;
}

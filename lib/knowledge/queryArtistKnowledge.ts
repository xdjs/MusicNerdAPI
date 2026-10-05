import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { knowledgeCursor } from "@/lib/knowledge/knowledgeCursor";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { searchArtistKnowledge } from "@/lib/knowledge/searchArtistKnowledge";
import { getArtistKnowledgeHistory } from "@/lib/knowledge/getArtistKnowledgeHistory";
import { MAX_KNOWLEDGE_BYTES } from "@/lib/knowledge/types";
import type { KnowledgeQuery, KnowledgeResults, KnowledgeSnapshot } from "@/lib/knowledge/types";

/** Answers a validated read from one authorized, consistent stored snapshot. */
export function queryArtistKnowledge<Q extends KnowledgeQuery>(
  snapshot: KnowledgeSnapshot,
  query: Q,
): KnowledgeResults[Q["operation"]] {
  const run = (): KnowledgeResults[keyof KnowledgeResults] => {
    if (query.operation === "search") return searchArtistKnowledge(snapshot, query);
    if (query.operation === "history") return getArtistKnowledgeHistory(snapshot, query);
    if (query.operation === "brief") {
      let remaining = 6000;
      let truncated = false;
      const clip = (value: string | null) => {
        if (value === null) return null;
        const result = remaining < 2 ? "" : knowledgeWindow(value, 0, remaining).text;
        remaining -= result.length;
        truncated ||= result.length < value.length;
        return result;
      };
      return {
        status: "ok",
        artistId: snapshot.artist.id,
        name: clip(snapshot.artist.name),
        bio: clip(snapshot.artist.bio),
        generatedLoreSummary: clip(snapshot.summary),
        summaryIsEvidence: false,
        historyRequired: true,
        coverage: snapshot.coverage,
        returnedChars: 6000 - remaining,
        truncated,
      };
    }
    if (query.operation === "read") {
      const source = snapshot.sources.find(s => s.metadata.sourceId === query.sourceId);
      if (!source) throw new KnowledgeError("not_found", 404, "Source unavailable for this artist");
      if (source.metadata.revision !== query.revision)
        throw new KnowledgeError(
          "revision_changed",
          409,
          "Source revision changed; reload its metadata",
        );
      const window = knowledgeWindow(source.text, query.start, query.maxChars);
      const nextStart = window.end < source.text.length ? window.end : null;
      return {
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
      };
    }
    const sources = snapshot.sources.filter(
      source => query.operation !== "sources" || !query.kind || source.metadata.kind === query.kind,
    );
    const items = query.operation === "sources" ? sources.map(s => s.metadata) : snapshot.jobs;
    const identities =
      query.operation === "sources"
        ? sources.map(s => [s.metadata.sourceId, s.metadata.revision])
        : snapshot.jobs;
    const cursor = knowledgeCursor(
      [
        snapshot.artist.id,
        query.operation,
        query.operation === "sources" ? (query.kind ?? null) : null,
        identities,
      ],
      query.cursor,
    );
    const [start, field, offset] = cursor.position;
    if (start > items.length || field !== 0 || offset !== 0)
      throw new KnowledgeError("invalid_input", 400, "Invalid list cursor position");
    const next = Math.min(items.length, start + query.limit);
    const nextCursor = next < items.length ? cursor.encode([next, 0, 0]) : null;
    const budget = {
      returnedChars: JSON.stringify(items.slice(start, next)).length,
      truncated: nextCursor !== null,
      nextCursor,
    };
    if (query.operation === "research-status")
      return {
        status: "ok",
        jobs: snapshot.jobs.slice(start, next),
        coverage: snapshot.coverage,
        budget,
      };
    const readable = sources.filter(s => s.text.trim()).length;
    return {
      status: "ok",
      sources: sources.slice(start, next).map(s => s.metadata),
      coverage: {
        ...snapshot.coverage,
        eligibleSources: sources.length,
        readableSources: readable,
        complete: readable === sources.length,
      },
      budget,
    };
  };
  const result = run();
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_KNOWLEDGE_BYTES)
    throw new KnowledgeError(
      "response_too_large",
      413,
      "Knowledge response exceeds its byte budget; request fewer records or characters",
    );
  return result as KnowledgeResults[Q["operation"]];
}

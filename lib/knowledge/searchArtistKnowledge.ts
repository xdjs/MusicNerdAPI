import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import type { KnowledgeQuery, KnowledgeResults, KnowledgeSnapshot } from "@/lib/knowledge/types";

/** Lexical baseline over every stored original window, never over publisher metadata. */
export function searchArtistKnowledge(
  snapshot: KnowledgeSnapshot,
  query: Extract<KnowledgeQuery, { operation: "search" }>,
): KnowledgeResults["search"] {
  const sources = snapshot.sources.filter(
    source => !query.kind || source.metadata.kind === query.kind,
  );
  const stop = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "did",
    "do",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
  ]);
  const words = query.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter(word => !stop.has(word)))];
  if (terms.length === 0) terms.push(...new Set(words));
  const candidates: {
    source: (typeof sources)[number];
    start: number;
    end: number;
    text: string;
    score: number;
  }[] = [];
  for (const source of sources) {
    for (let offset = 0; offset < source.text.length; offset += 800) {
      const window = knowledgeWindow(source.text, offset, 1600);
      const tokens = new Set(window.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
      const matched = terms.filter(term => tokens.has(term)).length;
      if (!matched) continue;
      const score =
        matched / Math.max(terms.length, 1) +
        (window.text.toLowerCase().includes(query.query.toLowerCase()) ? 1 : 0);
      candidates.push({ source, ...window, score });
      if (window.end === source.text.length) break;
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.source.metadata.sourceId.localeCompare(b.source.metadata.sourceId) ||
      a.start - b.start,
  );
  const passages: KnowledgeResults["search"]["passages"] = [];
  let returnedChars = 0;
  let omitted = false;
  for (const candidate of candidates) {
    if (
      passages.some(
        p =>
          p.source.sourceId === candidate.source.metadata.sourceId &&
          p.start < candidate.end &&
          p.end > candidate.start,
      )
    )
      continue;
    if (passages.length >= query.limit || query.maxChars - returnedChars < 2) {
      omitted = true;
      break;
    }
    const size = Math.min(candidate.end - candidate.start, query.maxChars - returnedChars);
    const firstMatch =
      [...candidate.text.matchAll(/[\p{L}\p{N}]+/gu)].find(match =>
        terms.includes(match[0].toLowerCase()),
      )?.index ?? 0;
    const start = Math.max(
      candidate.start,
      Math.min(candidate.end - size, candidate.start + firstMatch - Math.floor(size / 3)),
    );
    const window = knowledgeWindow(candidate.source.text, start, size);
    passages.push({
      source: candidate.source.metadata,
      revision: candidate.source.metadata.revision,
      ...window,
      page: null,
      startSeconds: null,
      endSeconds: null,
    });
    returnedChars += window.text.length;
    omitted ||= window.end < candidate.end;
  }
  const readable = sources.filter(s => s.text.trim()).length;
  return {
    status: "ok",
    passages,
    returnedChars,
    truncated: omitted,
    coverage: {
      ...snapshot.coverage,
      eligibleSources: sources.length,
      readableSources: readable,
      searchedSources: readable,
      complete: readable === sources.length,
    },
  };
}

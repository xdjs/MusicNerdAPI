import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { tokenizeKnowledgeText } from "@/lib/knowledge/tokenizeKnowledgeText";
import type { KnowledgeQuery, KnowledgeResults, KnowledgeSnapshot } from "@/lib/knowledge/types";

/** Ranks original windows using BM25 and phrase proximity, never publisher metadata. */
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
  const words = tokenizeKnowledgeText(query.query);
  const artistTerms = new Set(
    tokenizeKnowledgeText(snapshot.artist.name ?? "").map(token => token.stem),
  );
  const meaningful = words.filter(word => !stop.has(word.term) && !artistTerms.has(word.stem));
  const terms = [...new Set((meaningful.length ? meaningful : words).map(word => word.stem))];
  const pairs = [
    ...new Set(meaningful.slice(1).map((word, index) => `${meaningful[index].stem}\0${word.stem}`)),
  ];
  const candidates: {
    source: (typeof sources)[number];
    start: number;
    end: number;
    text: string;
    score: number;
    frequencies: Map<string, number>;
    wordCount: number;
    tokens: ReturnType<typeof tokenizeKnowledgeText>;
    pairs: Set<string>;
  }[] = [];
  const documentFrequency = new Map<string, number>();
  const pairFrequency = new Map<string, number>();
  let windowCount = 0;
  let totalWords = 0;
  for (const source of sources) {
    const sourceTokens = tokenizeKnowledgeText(source.text);
    let tokenStart = 0;
    for (let offset = 0; offset < source.text.length; offset += 800) {
      const window = knowledgeWindow(source.text, offset, 1600);
      while (tokenStart < sourceTokens.length && sourceTokens[tokenStart].start < window.start)
        tokenStart++;
      let tokenEnd = tokenStart;
      while (tokenEnd < sourceTokens.length && sourceTokens[tokenEnd].end <= window.end) tokenEnd++;
      const tokens = sourceTokens.slice(tokenStart, tokenEnd);
      const frequencies = new Map<string, number>();
      for (const token of tokens)
        frequencies.set(token.stem, (frequencies.get(token.stem) ?? 0) + 1);
      const contentTokens = tokens.filter(token => !stop.has(token.term));
      const contentPairs = new Set(
        contentTokens.slice(1).map((token, index) => `${contentTokens[index].stem}\0${token.stem}`),
      );
      for (const pair of pairs)
        if (contentPairs.has(pair)) pairFrequency.set(pair, (pairFrequency.get(pair) ?? 0) + 1);
      windowCount++;
      totalWords += tokens.length;
      for (const term of terms)
        if (frequencies.has(term))
          documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      if (terms.some(term => frequencies.has(term)))
        candidates.push({
          source,
          ...window,
          score: 0,
          frequencies,
          wordCount: tokens.length,
          tokens,
          pairs: contentPairs,
        });
      if (window.end === source.text.length) break;
    }
  }
  const averageLength = totalWords / Math.max(windowCount, 1);
  const weights = new Map(
    terms.map(term => {
      const count = documentFrequency.get(term) ?? 0;
      return [term, Math.log(1 + (windowCount - count + 0.5) / (count + 0.5))];
    }),
  );
  // Conventional BM25 k1=1.2, b=0.75; fixed before the transfer evaluation.
  for (const candidate of candidates) {
    for (const term of terms) {
      const frequency = candidate.frequencies.get(term) ?? 0;
      candidate.score +=
        ((weights.get(term) ?? 0) * frequency * 2.2) /
        (frequency + 1.2 * (0.25 + 0.75 * (candidate.wordCount / Math.max(averageLength, 1))));
    }
    // Cohesive query phrases should not lose to unrelated words spread over a window.
    for (const pair of pairs)
      if (candidate.pairs.has(pair)) {
        const count = pairFrequency.get(pair) ?? 0;
        candidate.score += 3 * Math.log(1 + (windowCount - count + 0.5) / (count + 0.5));
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
    if (passages.length >= query.limit || query.maxChars - returnedChars < 1) {
      omitted = true;
      break;
    }
    const size = Math.min(candidate.end - candidate.start, query.maxChars - returnedChars);
    if (size < 256 && size < candidate.text.length) {
      omitted = true;
      continue;
    }
    const firstMatch =
      candidate.tokens
        .filter(token => weights.has(token.stem))
        .sort((a, b) => (weights.get(b.stem) ?? 0) - (weights.get(a.stem) ?? 0))[0]?.start ??
      candidate.start;
    const start = Math.max(
      candidate.start,
      Math.min(candidate.end - size, firstMatch - Math.floor(size / 3)),
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

import { createResearchKnowledgeSnapshot } from "@/lib/questionResearch/createResearchKnowledgeSnapshot";
import { getEligibleResearchOriginals } from "@/lib/questionResearch/getEligibleResearchOriginals";
import { searchArtistKnowledge } from "@/lib/knowledge/searchArtistKnowledge";
import type { ResearchOriginal, ResearchRequest } from "@/lib/questionResearch/types";

/** Rank distinct eligible originals by their best existing-scored passage before the discovery cap. */
export function rankChatSourceOriginals(
  originals: ResearchOriginal[],
  request: ResearchRequest,
  artistName: string,
  limit: number,
): (ResearchOriginal & { match?: { start: number; end: number; anchor: number } })[] {
  // Stable representative for duplicate public copies; eligibility still prefers approved originals.
  const eligible = getEligibleResearchOriginals(
    [...originals].sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    request,
  );
  const snapshot = createResearchKnowledgeSnapshot(eligible, artistName);
  const anchors = new Map<string, number>();
  const result = searchArtistKnowledge(
    snapshot,
    { operation: "search", query: request.topic, limit, maxChars: limit * 1600 },
    {
      maxPassagesPerSource: 1,
      onMatch: match =>
        anchors.set(JSON.stringify([match.sourceId, match.revision, match.start]), match.anchor),
    },
  );
  const ranked = result.passages.map(p => ({
    ...eligible.find(o => o.sourceId === p.source.sourceId && o.revision === p.revision)!,
    match: {
      start: p.start,
      end: p.end,
      anchor: anchors.get(JSON.stringify([p.source.sourceId, p.revision, p.start])) ?? p.start,
    },
  }));
  const matched = new Set(ranked.map(o => o.sourceId));
  // Preserve discovery of nonmatching originals only after all ranked slots, with
  // deterministic source-ID order instead of database row order.
  return [...ranked, ...eligible.filter(o => !matched.has(o.sourceId))].slice(0, limit);
}

import { getEligibleResearchOriginals } from "./getEligibleResearchOriginals";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { searchArtistKnowledge } from "@/lib/knowledge/searchArtistKnowledge";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { createResearchKnowledgeSnapshot } from "./createResearchKnowledgeSnapshot";
import type {
  ResearchOriginal,
  ResearchRequest,
  ResearchReference,
} from "@/lib/questionResearch/types";

/** Reuse shared original-text ranking, then open bounded surrounding context with exact offsets. */
export function selectResearchReferences(
  originals: ResearchOriginal[],
  request: ResearchRequest,
  artistName: string,
  now = Date.now(),
): ResearchReference[] {
  const dateOf = (o: ResearchOriginal) => o.activityDate ?? o.publishedAt;
  const timeOf = (o: ResearchOriginal) => (dateOf(o) ? latestActivityTime(dateOf(o)!) : NaN);
  const eligible = getEligibleResearchOriginals(originals, request, now);
  // An overview is a chronological read, not a lexical search for the word "latest".
  // Unknown/future dates cannot establish the newest available activity.
  if (request.retrieval === "latest") {
    const dated = eligible.filter(o => dateOf(o) && Number.isFinite(timeOf(o)) && timeOf(o) <= now);
    const releases = dated.filter(o => o.activityDateKind === "release");
    // A newer post is not a newer release. Source/date constraints remain authoritative;
    // without catalog evidence, other originals are only candidates for assessment.
    const candidates =
      request.evidenceNeed === "release_date" && releases.length ? releases : dated;
    const overview = request.answerScope === "overview" && request.evidenceNeed === "reporting";
    // Broader candidate coverage stays within the existing 12,000-character total budget.
    return candidates
      .sort((a, b) => timeOf(b) - timeOf(a) || a.sourceId.localeCompare(b.sourceId))
      .slice(0, overview ? 6 : 3)
      .map(original => ({
        ...original,
        ...knowledgeWindow(original.text, 0, overview ? 2000 : 4000),
      }));
  }
  const snapshot = createResearchKnowledgeSnapshot(eligible, artistName);
  const result = searchArtistKnowledge(
    snapshot,
    {
      operation: "search",
      query: request.topic,
      limit: 4,
      maxChars: 6400,
    },
    { maxPassagesPerSource: 2 },
  );
  // Explicit source/date constraints identify originals even when the question has no body keywords.
  if (!result.passages.length && (request.targetUrl || request.fromDate || request.toDate)) {
    return [...eligible]
      .sort(
        (a, b) =>
          (Number.isFinite(timeOf(b)) ? timeOf(b) : 0) -
          (Number.isFinite(timeOf(a)) ? timeOf(a) : 0),
      )
      .slice(0, 3)
      .map(original => ({ ...original, ...knowledgeWindow(original.text, 0, 4000) }));
  }
  let remaining = 12000;
  return result.passages.flatMap(p => {
    const original = eligible.find(
      o => o.sourceId === p.source.sourceId && o.revision === p.revision,
    )!;
    if (remaining < 256) return [];
    const window = knowledgeWindow(
      original.text,
      Math.max(0, p.start - 800),
      Math.min(3200, remaining),
    );
    remaining -= window.text.length;
    return [{ ...original, ...window }];
  });
}

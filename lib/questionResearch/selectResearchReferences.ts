import { getEligibleResearchOriginals } from "./getEligibleResearchOriginals";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { searchArtistKnowledge } from "@/lib/knowledge/searchArtistKnowledge";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { researchIntentSupplement } from "./researchIntentSupplement";
import type { Evidence, KnowledgeSnapshot } from "@/lib/knowledge/types";
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
  options: { mode?: "navigation-context" } = {},
): ResearchReference[] {
  const dateOf = (o: ResearchOriginal) => o.activityDate ?? o.publishedAt;
  const timeOf = (o: ResearchOriginal) => (dateOf(o) ? latestActivityTime(dateOf(o)!) : NaN);
  const eligible = getEligibleResearchOriginals(originals, request, now);
  const navigationContext = options.mode === "navigation-context";
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
      .slice(0, navigationContext ? 4 : overview ? 6 : 3)
      .map(original => ({
        ...original,
        ...knowledgeWindow(original.text, 0, navigationContext ? 1000 : overview ? 2000 : 4000),
      }));
  }
  const sources: Evidence[] = eligible.map(o => ({
    text: o.text,
    metadata: {
      sourceId: o.sourceId,
      revision: o.revision,
      kind:
        o.evidenceKind === "caption"
          ? "social_caption"
          : o.evidenceKind === "provider_transcript"
            ? "reel_transcript"
            : "vault",
      title: null,
      titleTruncated: false,
      description: null,
      descriptionTruncated: false,
      url: o.url,
      publishedAt: o.publishedAt,
      ingestedAt: o.retrievedAt,
      uploadedAt: null,
      eventDate: null,
      originalSourceUrl: null,
      provenance: {
        origin: "vault_link",
        provider: null,
        method: null,
        speaker: o.speaker,
        publisher: null,
        speakerName: null,
        relationship: "unknown",
      },
      extraction: {
        readiness: "ready",
        storedChars: o.text.length,
        truncated: o.truncated,
        limitations: [],
      },
    },
  }));
  const snapshot: KnowledgeSnapshot = {
    artist: { id: "public", name: artistName, bio: null },
    sources,
    summary: null,
    history: [],
    latestAnswer: null,
    jobs: [],
    coverage: {
      eligibleSources: sources.length,
      readableSources: sources.length,
      searchedSources: 0,
      complete: true,
      limitations: [],
    },
  };
  const result = searchArtistKnowledge(
    snapshot,
    {
      operation: "search",
      query: request.topic,
      limit: 4,
      maxChars: navigationContext ? 4000 : 6400,
    },
    {
      maxPassageChars: navigationContext ? 1000 : undefined,
      maxPassagesPerSource: 2,
    },
  );
  // Explicit source/date constraints identify originals even when the question has no body keywords.
  if (!result.passages.length && (request.targetUrl || request.fromDate || request.toDate)) {
    let remaining = navigationContext ? 4000 : 12000;
    return [...eligible]
      .sort(
        (a, b) =>
          (Number.isFinite(timeOf(b)) ? timeOf(b) : 0) -
          (Number.isFinite(timeOf(a)) ? timeOf(a) : 0),
      )
      .slice(0, navigationContext ? 4 : 3)
      .flatMap(original => {
        if (navigationContext && remaining < 256) return [];
        const window = knowledgeWindow(
          original.text,
          0,
          Math.min(navigationContext ? 1000 : 4000, remaining),
        );
        remaining -= window.text.length;
        return [{ ...original, ...window }];
      });
  }
  const supplement = researchIntentSupplement(request);
  const supplementalPassages = supplement
    ? searchArtistKnowledge(
        snapshot,
        {
          operation: "search",
          query: supplement,
          limit: 12,
          maxChars: 12_000,
        },
        {
          maxPassageChars: navigationContext ? 1000 : undefined,
          maxPassagesPerSource: 2,
        },
      ).passages
    : [];
  const supplemental = supplementalPassages.find(
    passage => !result.passages.some(item => item.source.sourceId === passage.source.sourceId),
  );
  // Preserve the base ranking while reserving at most one distinct original for
  // a typed evidence intent that a compressed topic can otherwise miss.
  const selectedPassages = supplemental
    ? [...result.passages.slice(0, 3), supplemental]
    : result.passages;
  let remaining = navigationContext ? 4000 : 12000;
  return selectedPassages.flatMap(p => {
    const original = eligible.find(
      o => o.sourceId === p.source.sourceId && o.revision === p.revision,
    )!;
    if (remaining < 256) return [];
    const window = navigationContext
      ? { start: p.start, end: p.end, text: p.text }
      : knowledgeWindow(original.text, Math.max(0, p.start - 800), Math.min(3200, remaining));
    remaining -= window.text.length;
    return [{ ...original, ...window }];
  });
}

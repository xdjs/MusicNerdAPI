import { canonicalResearchUrl } from "@/lib/questionResearch/canonicalResearchUrl";
import { searchArtistKnowledge } from "@/lib/knowledge/searchArtistKnowledge";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
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
): ResearchReference[] {
  const from =
    request.fromDate ??
    (request.freshness === "recent"
      ? new Date(now - 7 * 86400_000).toISOString().slice(0, 10)
      : undefined);
  // Promotion retains both the discovery and its Lore copy. Identical text at
  // the same URL is one original, not independent corroboration or extra rank.
  const seen = new Set<string>();
  const distinct = [...originals]
    .sort((a, b) => Number(b.curation === "approved") - Number(a.curation === "approved"))
    .filter(original => {
      const key = `${canonicalResearchUrl(original.url)}\0${original.evidenceKind}\0${original.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const eligible = distinct.filter(
    o =>
      (!request.targetUrl ||
        canonicalResearchUrl(o.url) === canonicalResearchUrl(request.targetUrl)) &&
      (!request.platform ||
        request.targetUrl ||
        (request.platform === "x"
          ? ["x.com", "twitter.com"]
          : [`${request.platform}.com`]
        ).includes(new URL(o.url).hostname.replace(/^www\./, ""))) &&
      (request.evidenceNeed !== "spoken_content" || o.evidenceKind === "provider_transcript") &&
      (!from || (o.publishedAt !== null && o.publishedAt.slice(0, 10) >= from)) &&
      (!request.toDate || (o.publishedAt !== null && o.publishedAt.slice(0, 10) <= request.toDate)),
  );
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
      maxChars: 6400,
    },
    { maxPassagesPerSource: 2 },
  );
  // A specific URL is an instruction to inspect that original, even without lexical overlap.
  if (!result.passages.length && request.targetUrl) {
    return eligible
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

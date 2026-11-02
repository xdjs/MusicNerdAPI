import type { Evidence, KnowledgeSnapshot } from "@/lib/knowledge/types";
import type { ResearchOriginal } from "./types";

/** Adapt already eligible originals for the shared lexical scorer without changing source text. */
export function createResearchKnowledgeSnapshot(
  originals: ResearchOriginal[],
  artistName: string,
): KnowledgeSnapshot {
  const sources: Evidence[] = originals.map(o => ({
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
  return {
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
}

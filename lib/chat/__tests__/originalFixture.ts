import type { ResearchOriginal } from "@/lib/questionResearch/types";

/** A stored public original as `loadPublicResearchOriginals` returns it. */
export function originalFixture(sourceId: string, url: string, text: string): ResearchOriginal {
  return {
    sourceId,
    revision: "a".repeat(64),
    text,
    url,
    curation: "approved",
    evidenceKind: "original_text",
    speaker: "not_applicable",
    publishedAt: null,
    retrievedAt: null,
    truncated: false,
  };
}

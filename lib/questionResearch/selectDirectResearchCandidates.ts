import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { canonicalResearchUrl } from "./canonicalResearchUrl";
import { diversifyResearchOriginals } from "./diversifyResearchOriginals";
import { getEligibleResearchOriginals } from "./getEligibleResearchOriginals";
import { selectResearchReferences } from "./selectResearchReferences";
import type { ResearchOriginal, ResearchRequest } from "./types";

/** Offer bounded exact originals to an answer attempt; ranking never establishes sufficiency. */
export function selectDirectResearchCandidates(
  originals: ResearchOriginal[],
  request: ResearchRequest,
  artistName: string,
  now = Date.now(),
) {
  const eligible = getEligibleResearchOriginals(originals, request, now);
  const latestOverview =
    request.retrieval === "latest" &&
    request.answerScope === "overview" &&
    request.evidenceNeed === "reporting";
  const timeOf = (source: ResearchOriginal) =>
    latestActivityTime(source.activityDate ?? source.publishedAt ?? "") || 0;
  // Reporting previews prefer the written original over a transcript of the same post.
  // Recency chooses the cohort first; provider diversity cannot bring an older item into it.
  const chronological = [...eligible].sort(
    (a, b) => timeOf(b) - timeOf(a) || a.sourceId.localeCompare(b.sourceId),
  );
  const posts = new Map<string, ResearchOriginal>();
  for (const original of chronological) {
    const url = canonicalResearchUrl(original.url);
    const existing = posts.get(url);
    if (
      !existing ||
      (existing.evidenceKind === "provider_transcript" &&
        original.evidenceKind !== "provider_transcript")
    )
      posts.set(url, original);
  }
  const newestPosts = [...posts.values()]
    .sort((a, b) => timeOf(b) - timeOf(a) || a.sourceId.localeCompare(b.sourceId))
    .slice(0, 6);
  const references = latestOverview
    ? diversifyResearchOriginals(newestPosts).map(original => ({
        ...original,
        ...knowledgeWindow(original.text, 0, 2000),
      }))
    : selectResearchReferences(eligible, request, artistName, now);
  return {
    selection: "candidates" as const,
    references,
    coverage: {
      eligibleSources: eligible.length,
      returnedSources: new Set(references.map(reference => reference.sourceId)).size,
      returnedChars: references.reduce((total, reference) => total + reference.text.length, 0),
      exhaustive: false as const,
    },
  };
}

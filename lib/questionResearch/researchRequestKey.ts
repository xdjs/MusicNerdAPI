import { canonicalResearchUrl } from "@/lib/questionResearch/canonicalResearchUrl";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import type { ResearchRequest } from "@/lib/questionResearch/types";
/** Canonical request identity for concurrent reuse; never hash or persist an entire chat turn. */
export function researchRequestKey(request: ResearchRequest): string {
  return knowledgeRevision([
    request.topic.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(),
    request.evidenceNeed,
    request.freshness,
    request.targetUrl ? canonicalResearchUrl(request.targetUrl) : null,
    request.platform ?? null,
    request.fromDate ?? null,
    request.toDate ?? null,
    ...(request.retrieval === "latest" ? ["latest"] : []),
  ]);
}

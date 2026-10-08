import type { ResearchCandidateRow, ResearchEvidenceRow } from "@/lib/questionResearch/types";
/** Review projection excludes internal ownership, visitor context and provider payloads. */
export function toResearchCandidate(
  candidate: ResearchCandidateRow,
  evidence: ResearchEvidenceRow,
) {
  return {
    id: candidate.id,
    url: candidate.url,
    destination: candidate.destination,
    platform: candidate.platform,
    identity: candidate.identity,
    curation: candidate.curation,
    reason: candidate.reason,
    revision: evidence.revision,
    title: evidence.title,
    evidenceId: evidence.id,
  };
}

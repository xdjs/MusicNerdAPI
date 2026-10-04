import type { InterviewDraft, InterviewEvidence } from "@/lib/interviewExperiment/types";

/** Mechanical provenance gate; semantic support still requires a separate review.
 * @param draft - Untrusted generated question and supporting excerpts.
 * @param evidence - Exact records available to this generation.
 * @returns A rejection reason, or null when references and quotations resolve.
 */
export function validateInterviewDraft(
  draft: InterviewDraft,
  evidence: InterviewEvidence[],
): string | null {
  if (!draft.question.trim() || !draft.unknown.trim() || !draft.whyAsk.trim())
    return "Missing question, rationale or unknown";
  if (!draft.evidence.length) return "Missing evidence";
  const byId = new Map(evidence.map(e => [e.id, e]));
  for (const support of draft.evidence) {
    const source = byId.get(support.evidenceId);
    if (!source) return "Unknown evidence id";
    if (
      support.quote.trim().length < 12 ||
      !source.text.replace(/\s+/g, " ").includes(support.quote.replace(/\s+/g, " "))
    )
      return "Supporting quote is missing, too short or not verbatim";
  }
  return null;
}

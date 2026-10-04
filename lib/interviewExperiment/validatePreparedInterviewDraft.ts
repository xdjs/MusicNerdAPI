import { locateInterviewQuote } from "./locateInterviewQuote";
import { validateInterviewDraft } from "./validateInterviewDraft";
import type { InterviewDraft, InterviewEvidence } from "./types";

/** Apply source checks and measurable spoken-question checks to the prepared arm.
 * @param draft - Generated question, not yet semantically reviewed.
 * @param evidence - Exact original context shown to the model.
 * @returns A rejection reason, or null; passing does not establish editorial quality.
 */
export function validatePreparedInterviewDraft(
  draft: InterviewDraft,
  evidence: InterviewEvidence[],
): string | null {
  const error = validateInterviewDraft(draft, evidence);
  if (error) return error;
  if (draft.question.trim().split(/\s+/).length > 40) return "Spoken question exceeds 40 words";
  if ((draft.question.match(/\?/g) ?? []).length > 1) return "Ask one question at a time";
  for (const match of draft.question.matchAll(/[“"]([^“”"]+)[”"]/g))
    if (match[1].length >= 12 && !evidence.some(e => locateInterviewQuote(e.text, match[1])))
      return "Direct quotation in question is not present in original evidence";
  return null;
}

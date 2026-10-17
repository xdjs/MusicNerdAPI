import { locateInterviewQuote } from "./locateInterviewQuote";
import type { InterviewAnchor } from "./interviewPlanSchemas";
export type NumberedInterviewEvidence = {
  anchor:
    | Omit<Extract<InterviewAnchor, { kind: "original" }>, "quote">
    | Omit<Extract<InterviewAnchor, { kind: "answer" }>, "quote">;
  text: string;
};
/** Bind model-selected handles to host-owned identities and exact supplied text. */
export function resolveNumberedInterviewAnchors(
  references: Array<{ evidenceId: number; quote: string }>,
  evidence: NumberedInterviewEvidence[],
): InterviewAnchor[] {
  return references.map(ref => {
    const source =
      Number.isInteger(ref.evidenceId) && ref.evidenceId >= 0
        ? evidence[ref.evidenceId]
        : undefined;
    if (!source || typeof ref.quote !== "string" || ref.quote.length < 8 || ref.quote.length > 1600)
      throw new Error("Original reference mismatch");
    try {
      return {
        ...source.anchor,
        quote: locateInterviewQuote(source.text, ref.quote).quote,
      } as InterviewAnchor;
    } catch {
      throw new Error("Original reference mismatch");
    }
  });
}

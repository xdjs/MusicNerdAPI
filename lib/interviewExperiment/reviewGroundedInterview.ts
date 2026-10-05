import type { z } from "zod";
import { callInterviewModel } from "./callInterviewModel";
import { GROUNDED_REVIEW_INSTRUCTION, GROUNDED_VERDICT_SCHEMA } from "./groundedConst";
import { MEANING_REVIEW_ADDITION, MEANING_VERDICT_SCHEMA } from "./editorialConst";
import type {
  InterviewConversation,
  InterviewDraft,
  InterviewEditorial,
  InterviewEvidence,
} from "./types";

/** Check questions against originals, including anchored meaning fidelity for editorial follow-ups.
 * @param options - Actual questions/rationales, full evidence, current turns and explicit review model.
 * @returns Rejection per input question plus unchanged verdicts and usage for private audit.
 */
export async function reviewGroundedInterview(options: {
  artist: string;
  asOf: string;
  purpose: string;
  questions: InterviewDraft[];
  evidence: InterviewEvidence[];
  conversation: InterviewConversation | null;
  model: string;
  editorial?: boolean;
  listening?: InterviewEditorial["listening"];
}) {
  const { model, editorial, ...payload } = options;
  const { output, call } = await callInterviewModel(
    "grounded-review",
    GROUNDED_REVIEW_INSTRUCTION + (editorial ? "\n" + MEANING_REVIEW_ADDITION : ""),
    payload,
    editorial ? MEANING_VERDICT_SCHEMA : GROUNDED_VERDICT_SCHEMA,
    model,
    "archive",
  );
  const latest = options.conversation?.turns.at(-1)?.text;
  const rejections = options.questions.map((_, index) => {
    const matches = output.verdicts.filter(v => v.index === index);
    if (matches.length !== 1) return "Missing or duplicate verification verdict";
    const v = matches[0];
    const reasons: string[] = [];
    if (!(
      v.supported &&
      v.attributionCorrect &&
      v.respectsCorrections &&
      v.notAlreadyAnswered &&
      v.worthwhile &&
      v.temporalAccuracy &&
      v.respondsToAnswer &&
      v.respectsBoundaries &&
      v.singleQuestion &&
      v.acknowledgesConflicts &&
      v.premises.length > 0 &&
      v.premises.length <= 8 &&
      v.premises.every(p => p.status === "supported" || p.status === "open-question")
    )) {
      reasons.push(v.reason);
      reasons.push(
        ...v.premises
          .filter(p => p.status === "unsupported" || p.status === "contradicted")
          .map(p => `${p.claim}: ${p.reason}`),
      );
    }
    if (editorial && latest !== undefined) {
      const checks = (v as z.infer<typeof MEANING_VERDICT_SCHEMA>["verdicts"][number])
        .meaningChecks;
      if (!checks?.length || checks.length > 4)
        reasons.push("Missing or unbounded latest-answer meaning check");
      else
        for (const check of checks) {
          if (
            !check.sourceQuote.trim() ||
            check.sourceQuote.trim().length < Math.min(12, latest.trim().length) ||
            !latest.includes(check.sourceQuote)
          )
            reasons.push("Meaning check does not quote the latest artist answer");
          if (!check.faithful) reasons.push(`Meaning changed: ${check.reason}`);
        }
    }
    return reasons.length ? reasons.join("; ") : null;
  });
  return { rejections, verdicts: output.verdicts, call };
}

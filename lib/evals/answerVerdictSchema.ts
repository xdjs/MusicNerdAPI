import { z } from "zod";

/** The closed vocabulary the judge reports problems in; safe to print, unlike its free-text reason. */
export const ANSWER_ISSUES = [
  "missing_required_fact",
  "wrong_fact",
  "conflict_not_attributed",
  "invented_distinction",
  "overstated_certainty",
  "miscategorised_item",
  "unsupported_claim",
  "wrong_locator",
  "uncited_claim",
  "extra_unrequested_facts",
  "abstained",
  "none",
] as const;

/** The answer-quality judge's reply: two 0–1 numbers, why, and the problems in a closed vocabulary. */
export const answerVerdictSchema = z.object({
  relevance: z.number().min(0).max(1),
  groundedness: z.number().min(0).max(1),
  reason: z.string(),
  issues: z.array(z.enum(ANSWER_ISSUES)).max(8),
  /** The citation numbers `n` attached to claims the evidence does not support. */
  unsupportedCitations: z.array(z.number().int()).max(20),
  /** How many facts the reference requires that the answer leaves out. */
  missingRequired: z.number().int().min(0).max(20),
});

export type AnswerVerdict = z.infer<typeof answerVerdictSchema>;

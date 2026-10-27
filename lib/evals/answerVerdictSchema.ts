import { z } from "zod";

/** The answer-quality judge's reply: two 0–1 numbers and why. */
export const answerVerdictSchema = z.object({
  relevance: z.number().min(0).max(1),
  groundedness: z.number().min(0).max(1),
  reason: z.string(),
});

export type AnswerVerdict = z.infer<typeof answerVerdictSchema>;

import type { AnswerVerdict } from "@/lib/evals/answerVerdictSchema";
import type { Score } from "@/lib/evals/Score";

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The answer-quality judge's verdict as two scores, so relevance and groundedness move
 * separately in Braintrust's experiment diff.
 *
 * @param verdict - `judgeAnswer`'s reply.
 * @returns `answer_relevance` and `answer_groundedness`, each with the judge's reason.
 */
export function scoreAnswerQuality(verdict: AnswerVerdict): Score<{ reason: string }>[] {
  const metadata = { reason: verdict.reason };
  return [
    { name: "answer_relevance", score: clamp(verdict.relevance), metadata },
    { name: "answer_groundedness", score: clamp(verdict.groundedness), metadata },
  ];
}

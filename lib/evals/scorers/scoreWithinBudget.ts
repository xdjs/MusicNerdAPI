import type { Score } from "@/lib/evals/Score";

/**
 * 1 when a measured time is inside its budget, else 0 (MusicNerdWeb's `scoreWithinBudget`,
 * named per use so one suite can score two timings).
 *
 * @param name - The score's name, e.g. `first_text`.
 * @param ms - The measured time in milliseconds.
 * @param budgetMs - The budget in milliseconds.
 * @returns The score, with both numbers as evidence.
 */
export function scoreWithinBudget(
  name: string,
  ms: number,
  budgetMs: number,
): Score<{ ms: number; budgetMs: number }> {
  return { name, score: ms <= budgetMs ? 1 : 0, metadata: { ms, budgetMs } };
}

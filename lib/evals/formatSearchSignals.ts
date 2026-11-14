/**
 * The labelling run's line for why a search was or was not `weak`: whether any text list matched,
 * and the best vector score to three decimals (`none` when no vector hit came back).
 *
 * @param key - The case key.
 * @param result - `searchUnits`'s `weak` and `signals`.
 * @returns One line, numbers and flags only.
 */
export function formatSearchSignals(
  key: string,
  result: {
    weak: boolean;
    signals: { textMatched: boolean; bestVectorScore: number | null };
  },
): string {
  const best = result.signals.bestVectorScore;
  return `signals ${key} textMatched=${result.signals.textMatched} bestVector=${best === null ? "none" : best.toFixed(3)} weak=${result.weak}`;
}

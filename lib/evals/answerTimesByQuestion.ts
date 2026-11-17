/**
 * Each question's answer time for the run's time gate and report: a question with trials gets the
 * mean of its trials. Rows that ended in an error, which fail on their own, and rows without a
 * time are left out; a question left with no row is left out too.
 *
 * @param rows - The run's rows, each with its question key.
 * @returns One time in milliseconds per question, in the order questions first appear.
 */
export function answerTimesByQuestion(
  rows: { key: string; totalMs?: number; error?: string }[],
): number[] {
  const byKey = new Map<string, number[]>();
  for (const row of rows) {
    if (row.error || row.totalMs === undefined) continue;
    byKey.set(row.key, [...(byKey.get(row.key) ?? []), row.totalMs]);
  }
  return [...byKey.values()].map(times => times.reduce((sum, t) => sum + t, 0) / times.length);
}

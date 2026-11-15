/** One question's fact-checklist result across its answers. */
export type QuestionFacts = {
  key: string;
  shape?: string;
  /** Answers that were checked: no error, and a facts score. */
  answers: number;
  /** Answers with every required fact. */
  passes: number;
  /** Passes required: four of every five answers, rounded up. */
  needed: number;
};

/**
 * Each question's fact-checklist result for the gates and the report: how many of its answers
 * contain every required fact, and how many must (4 of 5, so 5 needs 4, 3 needs 3, 1 needs 1).
 * Rows that errored, which fail on their own, and rows with no facts score are not answers
 * here; a question left with none is left out.
 *
 * @param rows - The run's rows, each with its question key and scores.
 * @returns One entry per question, in the order questions first appear.
 */
export function factsByQuestion(
  rows: {
    key: string;
    shape?: string;
    error?: string;
    scores: Record<string, number | null>;
  }[],
): QuestionFacts[] {
  const byKey = new Map<string, { shape?: string; answers: number; passes: number }>();
  for (const row of rows) {
    const entry = byKey.get(row.key) ?? { answers: 0, passes: 0 };
    byKey.set(row.key, entry);
    entry.shape ??= row.shape;
    const facts = row.scores.facts;
    if (row.error || typeof facts !== "number") continue;
    entry.answers += 1;
    if (facts === 1) entry.passes += 1;
  }
  return [...byKey]
    .filter(([, e]) => e.answers > 0)
    .map(([key, e]) => ({
      key,
      ...(e.shape ? { shape: e.shape } : {}),
      answers: e.answers,
      passes: e.passes,
      needed: Math.ceil((e.answers * 4) / 5),
    }));
}

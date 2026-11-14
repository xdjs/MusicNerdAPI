/** One scored chat row as the gates read it: a case, or one trial of a case. */
export type ChatGateRow = {
  key: string;
  answerable: boolean;
  /** Set when the turn ended in an error instead of an answer. */
  error?: string;
  scores: Record<string, number | null>;
};

/** The thresholds a chat run must meet (xdjs/MusicNerdWeb#1424, decided 2026-11-12). */
export const CHAT_GATES = {
  /** Mean answer_relevance over questions. */
  meanRelevance: 0.8,
  /** Mean source_groundedness over questions. */
  meanGroundedness: 0.8,
  /** No question's answer_relevance below this. */
  questionRelevance: 0.6,
  /** No question's source_groundedness below this. */
  questionGroundedness: 0.6,
} as const;

const round = (n: number) => Math.round(n * 100) / 100;

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

/**
 * Why a chat run fails, one sentence each; empty when it passes. A question with trials
 * contributes the mean of its trials, so every question weighs the same in the run means.
 * The first_text score was removed on 2026-11-14: text within five seconds is not a
 * requirement, since answers that read or research take longer. first_signal is reported
 * and never gates.
 *
 * Gates: no row ends in an error; total_time is 1 on every row; citations and
 * evidence_scorable are 1 on every answerable row; relevance and groundedness means over
 * questions are at least 0.8, and no question falls below 0.6 on either.
 *
 * @param rows - Every scored row of the run.
 * @returns The failures.
 */
export function checkChatGates(rows: ChatGateRow[]): string[] {
  if (rows.length === 0) return ["No cases ran."];
  const failures: string[] = [];
  const byKey = new Map<string, ChatGateRow[]>();
  for (const row of rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);
  const relevanceByQuestion: number[] = [];
  const groundednessByQuestion: number[] = [];
  for (const [key, trials] of byKey) {
    const label = (i: number) => (trials.length > 1 ? `${key} trial ${i + 1}` : key);
    trials.forEach((row, i) => {
      if (row.error) failures.push(`${label(i)}: ended in an error (${row.error}).`);
      if (row.scores.total_time !== 1)
        failures.push(`${label(i)}: did not finish within the total time budget.`);
      if (row.answerable) {
        if (row.scores.citations !== 1)
          failures.push(`${label(i)}: a citation did not resolve to a returned source.`);
        if (row.scores.evidence_scorable !== 1)
          failures.push(`${label(i)}: the judge could not score the captured evidence.`);
      }
    });
    const relevance = mean(
      trials.flatMap(r =>
        (r.scores.answer_relevance ?? null) === null ? [] : [r.scores.answer_relevance!],
      ),
    );
    const groundedness = mean(
      trials.flatMap(r =>
        (r.scores.source_groundedness ?? null) === null ? [] : [r.scores.source_groundedness!],
      ),
    );
    if (relevance !== null) {
      relevanceByQuestion.push(relevance);
      if (relevance < CHAT_GATES.questionRelevance)
        failures.push(
          `${key}: answer_relevance ${round(relevance)} is below ${CHAT_GATES.questionRelevance}.`,
        );
    }
    if (groundedness !== null) {
      groundednessByQuestion.push(groundedness);
      if (groundedness < CHAT_GATES.questionGroundedness)
        failures.push(
          `${key}: source_groundedness ${round(groundedness)} is below ${CHAT_GATES.questionGroundedness}.`,
        );
    }
  }
  const meanRelevance = mean(relevanceByQuestion);
  const meanGroundedness = mean(groundednessByQuestion);
  if (meanRelevance === null) failures.push("No question received an answer_relevance score.");
  else if (meanRelevance < CHAT_GATES.meanRelevance)
    failures.push(
      `Mean answer_relevance ${round(meanRelevance)} is below ${CHAT_GATES.meanRelevance}.`,
    );
  if (meanGroundedness === null) failures.push("No question received a source_groundedness score.");
  else if (meanGroundedness < CHAT_GATES.meanGroundedness)
    failures.push(
      `Mean source_groundedness ${round(meanGroundedness)} is below ${CHAT_GATES.meanGroundedness}.`,
    );
  return failures;
}

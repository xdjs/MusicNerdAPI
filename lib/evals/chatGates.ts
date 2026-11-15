import { factsByQuestion } from "@/lib/evals/factsByQuestion";

/** One scored chat row as the gates read it: a case, or one trial of a case. */
export type ChatGateRow = {
  key: string;
  answerable: boolean;
  /** Set when the turn ended in an error instead of an answer. */
  error?: string;
  /** From the question being sent to the finished answer; absent when the row has no output. */
  totalMs?: number;
  scores: Record<string, number | null>;
  /** What the question tests (see `ChatCase.shape`); reported, never gated. */
  shape?: string;
};

/** The thresholds a chat run must meet (xdjs/MusicNerdWeb#1424; bar reset 2026-11-15). */
export const CHAT_GATES = {
  /** Mean answer_relevance over questions. */
  meanRelevance: 0.8,
  /** Mean source_groundedness over questions. */
  meanGroundedness: 0.8,
  /** Floor on answer_relevance for a question with no fact checklist. */
  uncheckedRelevance: 0.6,
} as const;

const round = (n: number) => Math.round(n * 100) / 100;

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

/**
 * Why a chat run fails, one sentence each; empty when it passes. The bar was reset on
 * 2026-11-15: accuracy is judged by fact checklists, there is no mean answer time gate, and no
 * question is exempt as known-hard. A question with trials contributes the mean of its trials
 * to the run means, so every question weighs the same.
 *
 * Gates: no row ends in an error; first_signal is 1 on every row that did not error;
 * total_time is 1 on every row; citations and evidence_scorable are 1 on every answerable row;
 * every required fact is present in at least 4 of every 5 answers to a question (rounded up,
 * so 3 answers need 3; rows that errored are not answers here but fail as errors); a question
 * with no facts score on any row (a why-question, one the documents cannot answer) must have a
 * mean answer_relevance of at least `uncheckedRelevance`; the means over questions of
 * answer_relevance and source_groundedness are at least 0.8. A low judge score on a question
 * with a checklist is not a failure by itself, only through those means.
 *
 * @param rows - Every scored row of the run.
 * @returns The failures.
 */
export function checkChatGates(rows: ChatGateRow[]): string[] {
  if (rows.length === 0) return ["No cases ran."];
  const failures: string[] = [];
  const byKey = new Map<string, ChatGateRow[]>();
  for (const row of rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);
  const checklists = new Map(factsByQuestion(rows).map(q => [q.key, q]));
  const relevanceByQuestion: number[] = [];
  const groundednessByQuestion: number[] = [];
  for (const [key, trials] of byKey) {
    const label = (i: number) => (trials.length > 1 ? `${key} trial ${i + 1}` : key);
    trials.forEach((row, i) => {
      if (row.error) failures.push(`${label(i)}: ended in an error (${row.error}).`);
      else if (row.scores.first_signal !== 1)
        failures.push(`${label(i)}: no status signal within 5 s.`);
      if (row.scores.total_time !== 1)
        failures.push(`${label(i)}: did not finish within the total time budget.`);
      if (row.answerable) {
        if (row.scores.citations !== 1)
          failures.push(`${label(i)}: a citation did not resolve to a returned source.`);
        if (row.scores.evidence_scorable !== 1)
          failures.push(`${label(i)}: the judge could not score the captured evidence.`);
      }
    });
    const checklist = checklists.get(key);
    if (checklist && checklist.passes < checklist.needed)
      failures.push(
        `${key}: every required fact in ${checklist.passes} of ${checklist.answers} answers; needs ${checklist.needed}.`,
      );
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
      if (!checklist && relevance < CHAT_GATES.uncheckedRelevance)
        failures.push(
          `${key}: answer_relevance ${round(relevance)} is below ${CHAT_GATES.uncheckedRelevance} (no fact checklist).`,
        );
    }
    if (groundedness !== null) groundednessByQuestion.push(groundedness);
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

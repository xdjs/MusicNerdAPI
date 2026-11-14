import { answerTimesByQuestion } from "@/lib/evals/answerTimesByQuestion";
import { KNOWN_HARD_FLOOR, MEAN_TOTAL_BUDGET_MS } from "@/lib/evals/chatBudgets";

/** One scored chat row as the gates read it: a case, or one trial of a case. */
export type ChatGateRow = {
  key: string;
  answerable: boolean;
  /** Set when the turn ended in an error instead of an answer. */
  error?: string;
  /** From the question being sent to the finished answer; absent when the row has no output. */
  totalMs?: number;
  scores: Record<string, number | null>;
  /** Set on the rows of a known-hard question (see `ChatCase.knownHard`). */
  knownHard?: { since: string; reason: string };
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

const fixed = (n: number) => n.toFixed(2);

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

/**
 * Why a chat run fails, one sentence each; empty when it passes. A question with trials
 * contributes the mean of its trials, so every question weighs the same in the run means.
 * The first_text score was removed on 2026-11-14: text within five seconds is not a
 * requirement, since answers that read or research take longer. Instead (Pete, 2026-11-14)
 * the status signal must show within five seconds and the mean answer time must hold.
 *
 * Gates: no row ends in an error; first_signal is 1 on every row that did not error; the
 * mean answer time over questions (rows that errored left out) is at most
 * `MEAN_TOTAL_BUDGET_MS`; total_time is 1 on every row; citations and
 * evidence_scorable are 1 on every answerable row; relevance and groundedness means over
 * questions are at least 0.8, and no question falls below 0.6 on either. A known-hard question
 * (2026-11-14) is held to `KNOWN_HARD_FLOOR` on the mean of its trials instead of 0.6; every
 * other gate applies to it, and it still counts in the means.
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
    const knownHard = trials.some(r => r.knownHard);
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
      if (knownHard) {
        if (relevance < KNOWN_HARD_FLOOR)
          failures.push(
            `${key}: answer_relevance ${fixed(relevance)} is below the known-hard floor ${KNOWN_HARD_FLOOR}.`,
          );
      } else if (relevance < CHAT_GATES.questionRelevance)
        failures.push(
          `${key}: answer_relevance ${round(relevance)} is below ${CHAT_GATES.questionRelevance}.`,
        );
    }
    if (groundedness !== null) {
      groundednessByQuestion.push(groundedness);
      if (knownHard) {
        if (groundedness < KNOWN_HARD_FLOOR)
          failures.push(
            `${key}: source_groundedness ${fixed(groundedness)} is below the known-hard floor ${KNOWN_HARD_FLOOR}.`,
          );
      } else if (groundedness < CHAT_GATES.questionGroundedness)
        failures.push(
          `${key}: source_groundedness ${round(groundedness)} is below ${CHAT_GATES.questionGroundedness}.`,
        );
    }
  }
  const meanTime = mean(answerTimesByQuestion(rows));
  if (meanTime !== null && meanTime > MEAN_TOTAL_BUDGET_MS)
    failures.push(
      `mean answer time ${(meanTime / 1000).toFixed(1)} s is above ${(MEAN_TOTAL_BUDGET_MS / 1000).toFixed(1)} s.`,
    );
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

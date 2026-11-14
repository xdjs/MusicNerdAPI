import { Reporter } from "braintrust";
import { answerTimesByQuestion } from "@/lib/evals/answerTimesByQuestion";
import { checkChatGates, type ChatGateRow } from "@/lib/evals/chatGates";
import type { ChatTurn } from "@/lib/evals/ChatTurn";

const SCORE_COLUMNS = [
  "first_signal",
  "total_time",
  "citations",
  "evidence_scorable",
  "answer_relevance",
  "source_groundedness",
  "mentions",
] as const;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Mean, median and slowest of per-question answer times; null when there are none. */
const answerTimeLine = (times: number[]) => {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;
  return `answer time: mean ${seconds(mean)}, median ${seconds(median)}, slowest ${seconds(sorted[sorted.length - 1])}`;
};

const cell = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : String(Math.round(value * 100) / 100);

/** One line per known-hard question: its trial means, reported on every run whatever the gates say. */
const knownHardLines = (rows: ChatGateRow[]) => {
  const byKey = new Map<string, ChatGateRow[]>();
  for (const row of rows)
    if (row.knownHard) byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);
  const meanOf = (trials: ChatGateRow[], score: string) => {
    const values = trials.flatMap(r => {
      const v = r.scores[score];
      return typeof v === "number" ? [v] : [];
    });
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : "-";
  };
  return [...byKey].map(
    ([key, trials]) =>
      `known-hard ${key}: answer_relevance ${meanOf(trials, "answer_relevance")}, source_groundedness ${meanOf(trials, "source_groundedness")} over ${trials.length} trials (not held to the 0.6 floor since ${trials[0].knownHard!.since})`,
  );
};

/** The parts of a Braintrust result row the reporter reads; the SDK types them as a union. */
type ResultRow = {
  output?: unknown;
  error?: unknown;
  scores?: Record<string, number | null>;
  metadata?: Record<string, unknown>;
  expected?: unknown;
};

/**
 * The chat suite's reporter: prints every row's scores and timings, the run means, the answer
 * time over questions (mean, median, slowest) and the Braintrust experiment link, then applies `checkChatGates`. Returning false makes
 * `braintrust eval` exit non-zero, which is what fails the hosted run.
 */
export const chatReporter = Reporter<boolean>("chat-gates", {
  reportEval(evaluator, result) {
    const rows: ChatGateRow[] = [];
    console.log(`\n${evaluator.evalName}`);
    console.log(
      [
        "case".padEnd(28),
        "signal",
        "first",
        "total",
        ...SCORE_COLUMNS.map(c => c.slice(0, 10).padStart(10)),
      ].join(" "),
    );
    for (const r of result.results as unknown as ResultRow[]) {
      const metadata = (r.metadata ?? {}) as {
        key?: unknown;
        trial?: unknown;
        knownHard?: { since: string; reason: string };
      };
      const output = (r.output ?? {}) as Partial<ChatTurn>;
      const key = String(metadata.key ?? "");
      const label = metadata.trial === undefined ? key : `${key} #${String(metadata.trial)}`;
      const error = output.error ?? (r.error ? String(r.error) : undefined);
      rows.push({
        key,
        answerable: Boolean((r.expected as { answerable?: unknown } | undefined)?.answerable),
        ...(error ? { error } : {}),
        ...(typeof output.totalMs === "number" ? { totalMs: output.totalMs } : {}),
        scores: r.scores ?? {},
        ...(metadata.knownHard ? { knownHard: metadata.knownHard } : {}),
      });
      console.log(
        [
          label.padEnd(28),
          `${output.firstSignalMs ?? "-"}`.padStart(6),
          `${output.firstTextMs ?? "-"}`.padStart(5),
          `${output.totalMs ?? "-"}`.padStart(5),
          ...SCORE_COLUMNS.map(c => cell(r.scores?.[c]).padStart(10)),
        ].join(" ") + (error ? `  error: ${error}` : ""),
      );
    }
    const means = Object.values(result.summary.scores ?? {})
      .map(s => `${s.name} ${cell(s.score)}`)
      .join(", ");
    if (means) console.log(`means: ${means}`);
    const times = answerTimeLine(answerTimesByQuestion(rows));
    if (times) console.log(times);
    for (const line of knownHardLines(rows)) console.log(line);
    if (result.summary.experimentUrl) console.log(`experiment: ${result.summary.experimentUrl}`);
    const failures = checkChatGates(rows);
    if (failures.length) {
      console.log(`\nGates failed (${failures.length}):`);
      for (const failure of failures) console.log(`  - ${failure}`);
    } else console.log("\nGates passed.");
    return failures.length === 0;
  },
  reportRun(reports) {
    return reports.every(Boolean);
  },
});

import { Reporter } from "braintrust";
import { checkChatGates, type ChatGateRow } from "@/lib/evals/chatGates";
import type { ChatTurn } from "@/lib/evals/ChatTurn";

const SCORE_COLUMNS = [
  "first_text",
  "total_time",
  "citations",
  "evidence_scorable",
  "answer_relevance",
  "source_groundedness",
] as const;

const cell = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : String(Math.round(value * 100) / 100);

/** The parts of a Braintrust result row the reporter reads; the SDK types them as a union. */
type ResultRow = {
  output?: unknown;
  error?: unknown;
  scores?: Record<string, number | null>;
  metadata?: Record<string, unknown>;
  expected?: unknown;
};

/**
 * The chat suite's reporter: prints every row's scores and timings, the run means and the
 * Braintrust experiment link, then applies `checkChatGates`. Returning false makes
 * `braintrust eval` exit non-zero, which is what fails the hosted run.
 */
export const chatReporter = Reporter<boolean>("chat-gates", {
  reportEval(evaluator, result) {
    const rows: ChatGateRow[] = [];
    console.log(`\n${evaluator.evalName}`);
    console.log(
      [
        "case".padEnd(28),
        "first",
        "total",
        ...SCORE_COLUMNS.map(c => c.slice(0, 10).padStart(10)),
      ].join(" "),
    );
    for (const r of result.results as unknown as ResultRow[]) {
      const metadata = (r.metadata ?? {}) as { key?: unknown; trial?: unknown };
      const output = (r.output ?? {}) as Partial<ChatTurn>;
      const key = String(metadata.key ?? "");
      const label = metadata.trial === undefined ? key : `${key} #${String(metadata.trial)}`;
      const error = output.error ?? (r.error ? String(r.error) : undefined);
      rows.push({
        key,
        answerable: Boolean((r.expected as { answerable?: unknown } | undefined)?.answerable),
        ...(error ? { error } : {}),
        scores: r.scores ?? {},
      });
      console.log(
        [
          label.padEnd(28),
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

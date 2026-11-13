import { Reporter } from "braintrust";
import { checkRetrievalGates, type RetrievalGateRow } from "@/lib/evals/retrievalGates";

const cell = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : String(Math.round(value * 100) / 100);

/** The parts of a Braintrust result row the reporter reads; the SDK types them as a union. */
type ResultRow = {
  output?: unknown;
  error?: unknown;
  scores?: Record<string, number | null>;
  metadata?: Record<string, unknown>;
};

/**
 * The retrieval suite's reporter: one row per case (hits, recall, rank, weak, labelled), the
 * Braintrust experiment link, then `checkRetrievalGates`. Returning false makes `braintrust eval`
 * exit non-zero. Prints keys and numbers only, never unit text.
 */
export const retrievalReporter = Reporter<boolean>("retrieval-gates", {
  reportEval(evaluator, result) {
    const rows: RetrievalGateRow[] = [];
    console.log(`\n${evaluator.evalName}`);
    console.log(
      ["case".padEnd(34), "hits", "recall", "rank", "weak".padEnd(5), "labelled"].join(" "),
    );
    for (const r of result.results as unknown as ResultRow[]) {
      const metadata = (r.metadata ?? {}) as { key?: unknown; labelled?: unknown };
      const output = (r.output ?? {}) as { hits?: unknown[]; weak?: boolean; error?: string };
      const key = String(metadata.key ?? "");
      const labelled = metadata.labelled === true;
      const error = output.error ?? (r.error ? String(r.error) : undefined);
      rows.push({ key, labelled, ...(error ? { error } : {}), scores: r.scores ?? {} });
      console.log(
        [
          key.padEnd(34),
          String(output.hits?.length ?? "-").padStart(4),
          cell(r.scores?.recall_at_8).padStart(6),
          cell(r.scores?.reciprocal_rank).padStart(4),
          String(output.weak ?? "-").padEnd(5),
          labelled ? "yes" : "no",
        ].join(" ") + (error ? `  error: ${error}` : ""),
      );
    }
    if (result.summary.experimentUrl) console.log(`experiment: ${result.summary.experimentUrl}`);
    const failures = checkRetrievalGates(rows);
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

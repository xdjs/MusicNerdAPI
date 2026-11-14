import { Reporter } from "braintrust";
import { formatRetrievalReport, type RetrievalReportRow } from "@/lib/evals/formatRetrievalReport";
import { checkRetrievalGates } from "@/lib/evals/retrievalGates";
import type { FactResult } from "@/lib/evals/scoreRetrievalFacts";

/** The parts of a Braintrust result row the reporter reads; the SDK types them as a union. */
type ResultRow = {
  output?: unknown;
  error?: unknown;
  scores?: Record<string, number | null>;
  metadata?: Record<string, unknown>;
};

/**
 * The retrieval suite's reporter: `formatRetrievalReport` (one row per case, then each missed
 * fact), the Braintrust experiment link, then `checkRetrievalGates`. Returning false makes `braintrust eval`
 * exit non-zero. Prints keys, numbers and fact names only, never unit text.
 */
export const retrievalReporter = Reporter<boolean>("retrieval-gates", {
  reportEval(evaluator, result) {
    const rows: RetrievalReportRow[] = [];
    console.log(`\n${evaluator.evalName}`);
    for (const r of result.results as unknown as ResultRow[]) {
      const metadata = (r.metadata ?? {}) as { key?: unknown; labelled?: unknown };
      const output = (r.output ?? {}) as {
        hits?: unknown[];
        weak?: boolean;
        facts?: FactResult[];
        error?: string;
      };
      const error = output.error ?? (r.error ? String(r.error) : undefined);
      rows.push({
        key: String(metadata.key ?? ""),
        labelled: metadata.labelled === true,
        ...(error ? { error } : {}),
        scores: r.scores ?? {},
        hits: output.hits?.length ?? null,
        weak: output.weak ?? null,
        facts: output.facts ?? [],
      });
    }
    for (const line of formatRetrievalReport(rows)) console.log(line);
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

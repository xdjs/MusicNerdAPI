import type { RetrievalGateRow } from "@/lib/evals/retrievalGates";
import type { FactResult } from "@/lib/evals/scoreRetrievalFacts";

/** One retrieval row as the report prints it. */
export type RetrievalReportRow = RetrievalGateRow & {
  /** Hits returned; null when the row has no output. */
  hits: number | null;
  weak: boolean | null;
  facts: FactResult[];
};

const cell = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : String(Math.round(value * 100) / 100);

/**
 * The retrieval suite's table: a header, one line per case (hits, facts found/total, recall, rank,
 * weak, labelled, any error), then one `missed: <case key>: <fact>` line per fact not retrieved.
 * Keys, numbers and our own fact names only, never unit text.
 *
 * @param rows - Every row of the run.
 * @returns The lines to print.
 */
export function formatRetrievalReport(rows: RetrievalReportRow[]): string[] {
  const lines = [
    ["case".padEnd(34), "hits", "facts", "recall", "rank", "weak".padEnd(5), "labelled"].join(" "),
  ];
  for (const r of rows)
    lines.push(
      [
        r.key.padEnd(34),
        String(r.hits ?? "-").padStart(4),
        `${r.facts.filter(f => f.found).length}/${r.facts.length}`.padStart(5),
        cell(r.scores.recall_at_8).padStart(6),
        cell(r.scores.reciprocal_rank).padStart(4),
        String(r.weak ?? "-").padEnd(5),
        r.labelled ? "yes" : "no",
      ].join(" ") + (r.error ? `  error: ${r.error}` : ""),
    );
  for (const r of rows)
    for (const f of r.facts) if (!f.found) lines.push(`missed: ${r.key}: ${f.fact}`);
  return lines;
}

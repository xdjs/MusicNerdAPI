/** One scored retrieval row as the gates read it. */
export type RetrievalGateRow = {
  key: string;
  /** The case has facts; only labelled cases gate. */
  labelled: boolean;
  /** Set when the search ended in an error. */
  error?: string;
  scores: Record<string, number | null>;
};

/** The thresholds a retrieval run must meet: mean recall, and a hit within the top `maxRank`. */
export const RETRIEVAL_GATES = { meanRecall: 0.8, maxRank: 8 } as const;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Why a retrieval run fails, one sentence each; empty when it passes. Only labelled cases gate:
 * mean `recall_at_8` over them is at least 0.8 and none has `reciprocal_rank` 0. Unlabelled cases
 * are reported but never gate, so runs can pass while labels are written; a run with no labelled
 * case fails, so an unlabelled suite cannot pass silently.
 *
 * @param rows - Every scored row of the run.
 * @returns The failures.
 */
export function checkRetrievalGates(rows: RetrievalGateRow[]): string[] {
  const labelled = rows.filter(r => r.labelled);
  if (labelled.length === 0) return ["no labelled cases"];
  const failures: string[] = [];
  for (const r of labelled) {
    if (r.error) failures.push(`${r.key}: ended in an error (${r.error}).`);
    if (!r.scores.reciprocal_rank)
      failures.push(`${r.key}: no labelled fact in the top ${RETRIEVAL_GATES.maxRank} results.`);
  }
  const mean = labelled.reduce((sum, r) => sum + (r.scores.recall_at_8 ?? 0), 0) / labelled.length;
  if (mean < RETRIEVAL_GATES.meanRecall)
    failures.push(
      `Mean recall_at_8 ${round(mean)} is below ${RETRIEVAL_GATES.meanRecall} over ${labelled.length} labelled cases.`,
    );
  return failures;
}

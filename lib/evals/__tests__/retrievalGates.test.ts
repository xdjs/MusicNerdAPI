import { describe, expect, it } from "vitest";
import {
  RETRIEVAL_GATES,
  checkRetrievalGates,
  type RetrievalGateRow,
} from "@/lib/evals/retrievalGates";

const row = (
  key: string,
  recall: number | null,
  rank: number | null,
  labelled = true,
): RetrievalGateRow => ({
  key,
  labelled,
  scores: { recall_at_8: recall, reciprocal_rank: rank },
});

describe("checkRetrievalGates", () => {
  it("passes when labelled cases meet the mean and every one finds a hit", () => {
    expect(checkRetrievalGates([row("a", 1, 1), row("b", 0.75, 0.5)])).toEqual([]);
  });

  it("fails a run with no labelled case, so an unlabelled suite cannot pass silently", () => {
    expect(checkRetrievalGates([row("a", 0, 0, false)])).toEqual(["no labelled cases"]);
    expect(checkRetrievalGates([])).toEqual(["no labelled cases"]);
  });

  it("never gates unlabelled cases", () => {
    expect(checkRetrievalGates([row("a", 1, 1), row("b", 0, 0, false)])).toEqual([]);
  });

  it("fails when the mean recall over labelled cases is below the gate", () => {
    const failures = checkRetrievalGates([row("a", 1, 1), row("b", 0.5, 1)]);
    expect(failures).toEqual([
      `Mean recall_at_8 0.75 is below ${RETRIEVAL_GATES.meanRecall} over 2 labelled cases.`,
    ]);
  });

  it("names a labelled case whose expected page is not in the top results", () => {
    const failures = checkRetrievalGates([row("a", 1, 1), row("b", 1, 1), row("c", 0, 0)]);
    expect(failures).toContain(
      `c: no expected unit in the top ${RETRIEVAL_GATES.maxRank} results.`,
    );
  });

  it("counts an unscored labelled case as a miss", () => {
    const failures = checkRetrievalGates([{ ...row("a", null, null), error: "boom" }]);
    expect(failures).toContain("a: ended in an error (boom).");
    expect(failures).toContain("a: no expected unit in the top 8 results.");
  });
});

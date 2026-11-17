import { describe, expect, it } from "vitest";
import { formatJudgeIssues } from "@/lib/evals/formatJudgeIssues";

const base = { relevance: 0.5, groundedness: 0.5 };

describe("formatJudgeIssues", () => {
  it("lists issues, unsupported citation numbers and the missing count", () => {
    expect(
      formatJudgeIssues({
        ...base,
        reason: "r",
        issues: ["wrong_fact", "uncited_claim"],
        unsupportedCitations: [1, 3],
        missingRequired: 2,
      }),
    ).toBe("judge: issues=[wrong_fact; uncited_claim] unsupported=[1, 3] missing=2");
  });

  it("prints empty lists", () => {
    expect(
      formatJudgeIssues({
        ...base,
        reason: "r",
        issues: [],
        unsupportedCitations: [],
        missingRequired: 0,
      }),
    ).toBe("judge: issues=[] unsupported=[] missing=0");
  });

  it("never includes the reason", () => {
    const line = formatJudgeIssues({
      ...base,
      reason: "SENTINEL-REASON-TEXT [2] says the band formed in 1998",
      issues: ["none"],
      unsupportedCitations: [2],
      missingRequired: 0,
    });
    expect(line).not.toContain("SENTINEL");
    expect(line).not.toContain("1998");
  });
});

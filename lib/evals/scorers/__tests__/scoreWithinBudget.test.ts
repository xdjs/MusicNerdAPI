import { describe, it, expect } from "vitest";
import { scoreWithinBudget } from "@/lib/evals/scorers/scoreWithinBudget";

describe("scoreWithinBudget", () => {
  it("scores 1 at or under the budget, under the given name", () => {
    expect(scoreWithinBudget("first_text", 4_999, 5_000)).toEqual({
      name: "first_text",
      score: 1,
      metadata: { ms: 4_999, budgetMs: 5_000 },
    });
    expect(scoreWithinBudget("first_text", 5_000, 5_000).score).toBe(1);
  });

  it("scores 0 over the budget", () => {
    expect(scoreWithinBudget("total_time", 20_001, 20_000).score).toBe(0);
  });
});

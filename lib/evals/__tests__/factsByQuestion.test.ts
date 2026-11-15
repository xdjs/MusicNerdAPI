import { describe, expect, it } from "vitest";
import { factsByQuestion } from "@/lib/evals/factsByQuestion";

const row = (
  key: string,
  facts: number | null,
  extra: { shape?: string; error?: string } = {},
) => ({
  key,
  scores: { facts },
  ...extra,
});

describe("factsByQuestion", () => {
  it("counts answers and passes per question, in first-appearance order", () => {
    expect(factsByQuestion([row("b", 1), row("a", 0.5), row("b", 0), row("a", 1)])).toEqual([
      { key: "b", answers: 2, passes: 1, needed: 2 },
      { key: "a", answers: 2, passes: 1, needed: 2 },
    ]);
  });

  it("needs four of every five answers, rounded up", () => {
    const needed = (n: number) =>
      factsByQuestion(Array.from({ length: n }, () => row("q", 1)))[0].needed;
    expect([1, 3, 5, 10].map(needed)).toEqual([1, 3, 4, 8]);
  });

  it("leaves out errored rows and rows without a facts score", () => {
    expect(
      factsByQuestion([
        row("q", 1),
        row("q", 1, { error: "boom" }),
        row("q", null),
        { key: "q", scores: {} },
        row("only-errors", 1, { error: "boom" }),
        row("none", null),
      ]),
    ).toEqual([{ key: "q", answers: 1, passes: 1, needed: 1 }]);
  });

  it("takes the first defined shape among a question's rows", () => {
    expect(
      factsByQuestion([row("q", 1), row("q", 1, { shape: "list" }), row("q", 1, { shape: "why" })]),
    ).toEqual([{ key: "q", shape: "list", answers: 3, passes: 3, needed: 3 }]);
  });
});

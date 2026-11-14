import { describe, expect, it } from "vitest";
import { scoreRetrievalFacts } from "@/lib/evals/scoreRetrievalFacts";
import type { RetrievalFact } from "@/lib/evals/retrievalLabels";

const unit = (sourceId: string, locator: string, sourceKind = "vault" as const) => ({
  sourceKind,
  sourceId,
  locator,
});

const facts: RetrievalFact[] = [
  { fact: "first", anyOf: [unit("a", "p.1"), unit("b", "p.2")] },
  { fact: "second", anyOf: [unit("c", "p.3")] },
];

describe("scoreRetrievalFacts", () => {
  it("finds a fact when any one of its units is a hit, and ranks it at its first hit", () => {
    const hits = [unit("x", "p.1"), unit("b", "p.2"), unit("a", "p.1")];
    expect(scoreRetrievalFacts({ hits, weak: false }, { facts, answerable: true })).toEqual({
      recall: 0.5,
      reciprocalRank: 0.5,
      facts: [
        { fact: "first", found: true, rank: 2 },
        { fact: "second", found: false, rank: null },
      ],
    });
  });

  it("scores full recall and the best rank over every fact", () => {
    const hits = [unit("c", "p.3"), unit("a", "p.1")];
    const score = scoreRetrievalFacts({ hits, weak: false }, { facts, answerable: true });
    expect(score.recall).toBe(1);
    expect(score.reciprocalRank).toBe(1);
  });

  it("matches on source kind, source id and locator, ignoring whitespace in the locator", () => {
    const one: RetrievalFact[] = [{ fact: "f", anyOf: [unit("a", "p. 1")] }];
    expect(
      scoreRetrievalFacts(
        { hits: [unit("a", "p.1 ")], weak: false },
        { facts: one, answerable: true },
      ).recall,
    ).toBe(1);
    expect(
      scoreRetrievalFacts(
        { hits: [{ ...unit("a", "p.1"), sourceKind: "social" as never }], weak: false },
        { facts: one, answerable: true },
      ).recall,
    ).toBe(0);
    expect(
      scoreRetrievalFacts(
        { hits: [unit("a", "p.10")], weak: false },
        { facts: one, answerable: true },
      ).recall,
    ).toBe(0);
  });

  it("scores nothing found as 0 recall and 0 reciprocal rank", () => {
    expect(
      scoreRetrievalFacts({ hits: [], weak: false }, { facts, answerable: true }),
    ).toMatchObject({
      recall: 0,
      reciprocalRank: 0,
    });
  });

  it("with no facts, scores an unanswerable case 1 only when the search is weak", () => {
    const none = { facts: [], answerable: false };
    expect(scoreRetrievalFacts({ hits: [], weak: true }, none)).toEqual({
      recall: 1,
      reciprocalRank: 0,
      facts: [],
    });
    expect(scoreRetrievalFacts({ hits: [unit("a", "p.1")], weak: false }, none).recall).toBe(0);
    expect(
      scoreRetrievalFacts({ hits: [], weak: true }, { facts: [], answerable: true }).recall,
    ).toBe(0);
  });
});

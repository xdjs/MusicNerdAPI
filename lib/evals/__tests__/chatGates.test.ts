import { describe, expect, it } from "vitest";
import { CHAT_GATES, checkChatGates, type ChatGateRow } from "@/lib/evals/chatGates";

const good = (key: string, overrides: Partial<ChatGateRow["scores"]> = {}): ChatGateRow => ({
  key,
  answerable: true,
  totalMs: 5000,
  scores: {
    first_signal: 1,
    total_time: 1,
    citations: 1,
    evidence_scorable: 1,
    answer_relevance: 0.9,
    source_groundedness: 0.9,
    ...overrides,
  },
});

describe("checkChatGates", () => {
  it("passes a run that meets every gate", () => {
    expect(checkChatGates([good("a"), good("b")])).toEqual([]);
  });

  it("requires the status signal within 5 s on every row that did not error", () => {
    const failures = checkChatGates([
      good("a", { first_signal: 0 }),
      good("t"),
      good("t", { first_signal: null }),
      { ...good("e", { first_signal: null }), error: "429 limit" },
    ]);
    expect(failures).toContain("a: no status signal within 5 s.");
    expect(failures).toContain("t trial 2: no status signal within 5 s.");
    expect(failures.filter(f => f.includes("status signal"))).toHaveLength(2);
  });

  it("fails an empty run", () => {
    expect(checkChatGates([])).toEqual(["No cases ran."]);
  });

  it("names a row that ended in an error or missed the total time budget", () => {
    const failures = checkChatGates([
      { ...good("a"), error: "429 limit", scores: { ...good("a").scores, total_time: null } },
      good("b", { total_time: 0 }),
    ]);
    expect(failures).toContain("a: ended in an error (429 limit).");
    expect(failures).toContain("a: did not finish within the total time budget.");
    expect(failures).toContain("b: did not finish within the total time budget.");
  });

  it("requires citations and scorable evidence on answerable rows only", () => {
    const failures = checkChatGates([
      good("a", { citations: 0, evidence_scorable: 0 }),
      { ...good("control", { citations: null, evidence_scorable: 0 }), answerable: false },
      good("c"),
    ]);
    expect(failures).toEqual([
      "a: a citation did not resolve to a returned source.",
      "a: the judge could not score the captured evidence.",
    ]);
  });

  it("applies the run means over questions", () => {
    const failures = checkChatGates([
      good("a", { answer_relevance: 0.5, source_groundedness: 0.55, facts: 1 }),
      good("b", { answer_relevance: 1, source_groundedness: 1, facts: 1 }),
    ]);
    expect(failures).toEqual([
      `Mean answer_relevance 0.75 is below ${CHAT_GATES.meanRelevance}.`,
      `Mean source_groundedness 0.78 is below ${CHAT_GATES.meanGroundedness}.`,
    ]);
  });

  it("averages a question's trials before applying the means and the unchecked floor", () => {
    // Three trials at 0.5, 0.7 and 0.9 average 0.7: above the 0.6 floor, and the question
    // counts once against the other question's 1.0 (mean 0.85).
    expect(
      checkChatGates([
        good("t", { answer_relevance: 0.5 }),
        good("t", { answer_relevance: 0.7 }),
        good("t", { answer_relevance: 0.9 }),
        good("u", { answer_relevance: 1 }),
      ]),
    ).toEqual([]);
    // Trials at 0.4, 0.5 and 0.6 average 0.5: below the floor, while the run mean over the
    // three questions (0.5, 1, 1) still clears 0.8.
    expect(
      checkChatGates([
        good("t", { answer_relevance: 0.4 }),
        good("t", { answer_relevance: 0.5 }),
        good("t", { answer_relevance: 0.6 }),
        good("u", { answer_relevance: 1 }),
        good("v", { answer_relevance: 1 }),
      ]),
    ).toEqual([
      `t: answer_relevance 0.5 is below ${CHAT_GATES.uncheckedRelevance} (no fact checklist).`,
    ]);
  });

  it("labels the failing trial of a repeated question", () => {
    const failures = checkChatGates([good("t"), good("t", { total_time: 0 })]);
    expect(failures).toEqual(["t trial 2: did not finish within the total time budget."]);
  });

  it("fails a run where no question was judged", () => {
    const failures = checkChatGates([
      good("a", { evidence_scorable: 0, answer_relevance: null, source_groundedness: null }),
    ]);
    expect(failures).toContain("No question received an answer_relevance score.");
    expect(failures).toContain("No question received a source_groundedness score.");
  });

  describe("fact checklists", () => {
    const trials = (key: string, facts: (number | null)[]) =>
      facts.map(f => good(key, { facts: f }));

    it("passes a question with every fact in 4 of 5 answers", () => {
      expect(checkChatGates(trials("q", [1, 1, 0.5, 1, 1]))).toEqual([]);
    });

    it("fails 3 of 5 with the exact message", () => {
      expect(checkChatGates(trials("q", [1, 0, 1, 0.5, 1]))).toEqual([
        "q: every required fact in 3 of 5 answers; needs 4.",
      ]);
    });

    it("needs all 3 of 3 answers, so 2 of 3 fails", () => {
      expect(checkChatGates(trials("q", [1, 1, 0]))).toEqual([
        "q: every required fact in 2 of 3 answers; needs 3.",
      ]);
    });

    it("does not count an errored row as an answer, but still fails it as an error", () => {
      const rows = [
        ...trials("q", [1, 1, 1, 1]),
        { ...good("q", { facts: null, first_signal: null, total_time: null }), error: "boom" },
      ];
      expect(checkChatGates(rows)).toEqual([
        "q trial 5: ended in an error (boom).",
        "q trial 5: did not finish within the total time budget.",
      ]);
    });

    it("holds a question without facts scores to the 0.6 relevance floor", () => {
      const others = ["a", "b", "c", "d", "e", "f"].map(k => good(k, { answer_relevance: 1 }));
      expect(checkChatGates([...others, good("n", { answer_relevance: 0.55 })])).toEqual([
        "n: answer_relevance 0.55 is below 0.6 (no fact checklist).",
      ]);
    });

    it("does not fail a question with facts scores on a low judge score by itself", () => {
      const failures = checkChatGates([
        good("a", { facts: 1, answer_relevance: 0.3, source_groundedness: 0.3 }),
        ...["b", "c", "d", "e", "f", "g", "h", "i", "j"].map(k => good(k, { facts: 1 })),
      ]);
      expect(failures).toEqual([]);
    });

    it("counts a low judge score on a question with facts in the run means", () => {
      const failures = checkChatGates([
        good("a", { facts: 1, answer_relevance: 0.3, source_groundedness: 0.3 }),
        good("b", { facts: 1 }),
      ]);
      expect(failures).toEqual([
        "Mean answer_relevance 0.6 is below 0.8.",
        "Mean source_groundedness 0.6 is below 0.8.",
      ]);
    });
  });
});

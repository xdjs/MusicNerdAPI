import { describe, expect, it } from "vitest";
import { MEAN_TOTAL_BUDGET_MS } from "@/lib/evals/chatBudgets";
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

  it(`fails when the mean answer time over questions is above ${MEAN_TOTAL_BUDGET_MS} ms`, () => {
    // Question t averages its trials (6 s and 12 s: 9 s); with u at 7.4 s the mean is 8.2 s.
    expect(
      checkChatGates([
        { ...good("t"), totalMs: 6000 },
        { ...good("t"), totalMs: 12000 },
        { ...good("u"), totalMs: 7400 },
      ]),
    ).toEqual(["mean answer time 8.2 s is above 8.0 s."]);
    // At exactly the budget it passes, and a row that errored does not count toward the mean.
    expect(
      checkChatGates([
        { ...good("t"), totalMs: 8000 },
        { ...good("u"), totalMs: 8000 },
        { ...good("v"), totalMs: 60000, error: "timeout" },
      ]),
    ).toEqual(["v: ended in an error (timeout)."]);
  });

  it("never gates the mentions score", () => {
    expect(checkChatGates([good("a", { mentions: 0 }), good("b", { mentions: null })])).toEqual([]);
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

  it("applies the per-question floors and the run means over questions", () => {
    const failures = checkChatGates([
      good("a", { answer_relevance: 0.5, source_groundedness: 0.55 }),
      good("b", { answer_relevance: 1, source_groundedness: 1 }),
    ]);
    expect(failures).toEqual([
      `a: answer_relevance 0.5 is below ${CHAT_GATES.questionRelevance}.`,
      `a: source_groundedness 0.55 is below ${CHAT_GATES.questionGroundedness}.`,
      `Mean answer_relevance 0.75 is below ${CHAT_GATES.meanRelevance}.`,
      `Mean source_groundedness 0.78 is below ${CHAT_GATES.meanGroundedness}.`,
    ]);
  });

  it("averages a question's trials before applying floors and means", () => {
    // Three trials of one question at 0.5, 0.7 and 0.9 average 0.7: above the floor, and the
    // question counts once against the other question's 1.0 (mean 0.85).
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
    ).toEqual([`t: answer_relevance 0.5 is below ${CHAT_GATES.questionRelevance}.`]);
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

  describe("known-hard questions", () => {
    const hard = { since: "2026-11-14", reason: "tracked" };
    const hardTrials = (relevance: number[], overrides: Partial<ChatGateRow["scores"]> = {}) =>
      relevance.map(r => ({
        ...good("h", { answer_relevance: r, source_groundedness: 0.9, ...overrides }),
        knownHard: hard,
      }));

    it("does not fail a known-hard question on score, even at 0.2", () => {
      // Seven questions at 0.9 and the known-hard one at 0.2 keep the run mean at 0.8125.
      const rows = ["a", "b", "c", "d", "e", "f", "g"].map(k => good(k));
      const failures = checkChatGates([
        ...rows,
        ...hardTrials([0.2, 0.2, 0.2], { source_groundedness: 0.2 }),
      ]);
      expect(failures).toEqual([]);
    });

    it("still fails a dangling citation or unscorable evidence", () => {
      const failures = checkChatGates([
        good("a"),
        ...hardTrials([0.8, 0.8], { citations: 0 }),
        { ...hardTrials([0.8])[0], scores: { ...good("h").scores, evidence_scorable: 0 } },
      ]);
      expect(failures).toContain("h trial 1: a citation did not resolve to a returned source.");
      expect(failures).toContain("h trial 3: the judge could not score the captured evidence.");
    });

    it("still fails a known-hard question on an error row or on time", () => {
      const failures = checkChatGates([
        good("a"),
        { ...hardTrials([0.9])[0], error: "boom" },
        { ...hardTrials([0.9])[0], scores: { ...good("h").scores, total_time: 0 } },
      ]);
      expect(failures).toContain("h trial 1: ended in an error (boom).");
      expect(failures).toContain("h trial 2: did not finish within the total time budget.");
    });

    it("still holds a normal question at 0.55 to 0.6", () => {
      expect(checkChatGates([good("a"), good("n", { answer_relevance: 0.55 })])).toContain(
        "n: answer_relevance 0.55 is below 0.6.",
      );
    });

    it("counts a known-hard question in the run means", () => {
      // Means: (0.9 + 0.5) / 2 = 0.7, below 0.8, although the question itself is not gated on score.
      const failures = checkChatGates([good("a"), ...hardTrials([0.5])]);
      expect(failures).toContain("Mean answer_relevance 0.7 is below 0.8.");
      expect(failures).not.toContain(expect.stringContaining("known-hard"));
    });
  });
});

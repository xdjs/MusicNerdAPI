import { afterEach, describe, expect, it, vi } from "vitest";
import { chatReporter } from "@/lib/evals/chatReporter";

const row = (key: string, totalMs: number, trial?: number) => ({
  output: { firstSignalMs: 900, firstTextMs: totalMs - 10, totalMs },
  expected: { answerable: true },
  metadata: { key, ...(trial ? { trial } : {}) },
  scores: {
    first_signal: 1,
    total_time: 1,
    citations: 1,
    evidence_scorable: 1,
    answer_relevance: 0.9,
    source_groundedness: 0.9,
  },
});

const report = (results: unknown[]) =>
  chatReporter.reportEval(
    { evalName: "chat" } as never,
    {
      results,
      summary: { scores: { total_time: { name: "total_time", score: 1 } } },
    } as never,
    {} as never,
  );

describe("chatReporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the answer time mean, median and slowest over questions after the means", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const passed = await report([
      row("a", 4000, 1),
      row("a", 6000, 2),
      row("b", 3000),
      row("c", 7600),
    ]);
    const lines = log.mock.calls.map(([line]) => String(line));
    const means = lines.findIndex(line => line.startsWith("means:"));
    // Per question: a 5.0 s (its trials' mean), b 3.0 s, c 7.6 s.
    expect(lines[means + 1]).toBe("answer time: mean 5.2 s, median 5.0 s, slowest 7.6 s");
    expect(passed).toBe(true);
  });

  it("does not fail the run on a slow mean answer time", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await report([row("a", 9000), row("b", 9000)])).toBe(true);
  });

  describe("fact checklists", () => {
    const withFacts = (key: string, facts: number, shape?: string, trial?: number) => ({
      ...row(key, 4000, trial),
      metadata: { key, ...(trial ? { trial } : {}), ...(shape ? { shape } : {}) },
      scores: { ...row(key, 4000).scores, facts },
    });

    it("prints a line per question, the total and the pass rate by shape", async () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const passed = await report([
        ...[1, 1, 1, 1, 0].map((f, i) => withFacts("a", f, "list", i + 1)),
        ...[1, 0].map((f, i) => withFacts("b", f, "why", i + 1)),
        withFacts("c", 1, "list"),
      ]);
      const lines = log.mock.calls.map(([line]) => String(line));
      const times = lines.findIndex(line => line.startsWith("answer time:"));
      expect(lines.slice(times + 1, times + 6)).toEqual([
        "facts a: 4/5",
        "facts b: 1/2 FAIL",
        "facts c: 1/1",
        "facts: 2 of 3 questions pass",
        "by shape: list 2/2, why 0/1",
      ]);
      expect(lines).toContain("  - b: every required fact in 1 of 2 answers; needs 2.");
      expect(passed).toBe(false);
    });

    it("prints no shape line when no row has a shape", async () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await report([withFacts("a", 1)]);
      const lines = log.mock.calls.map(([line]) => String(line));
      expect(lines).toContain("facts: 1 of 1 questions pass");
      expect(lines.some(line => line.startsWith("by shape"))).toBe(false);
    });
  });
});

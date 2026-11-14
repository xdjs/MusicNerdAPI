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

  it("fails the run on the mean answer time", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await report([row("a", 9000), row("b", 9000)])).toBe(false);
    expect(log.mock.calls.map(([line]) => String(line))).toContain(
      "  - mean answer time 9.0 s is above 8.0 s.",
    );
  });

  it("prints one line per known-hard question after the means", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const hard = (trial: number, relevance: number) => ({
      ...row("h", 4000, trial),
      metadata: {
        key: "h",
        trial,
        knownHard: { since: "2026-11-14", reason: "tracked" },
      },
      scores: { ...row("h", 4000).scores, answer_relevance: relevance, source_groundedness: 0.8 },
    });
    await report([hard(1, 0.4), hard(2, 0.6), row("b", 3000)]);
    const lines = log.mock.calls.map(([line]) => String(line));
    const means = lines.findIndex(line => line.startsWith("means:"));
    expect(lines.slice(means + 1)).toContain(
      "known-hard h: answer_relevance 0.50, source_groundedness 0.80 over 2 trials (reported, not gated on score, since 2026-11-14)",
    );
    expect(lines.filter(line => line.startsWith("known-hard"))).toHaveLength(1);
  });
});

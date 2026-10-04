import { describe, expect, it } from "vitest";
import { selectInterviewEvidence } from "@/lib/interviewExperiment/selectInterviewEvidence";
import { evidence } from "./evidence";
describe("selectInterviewEvidence", () => {
  it("excludes future publication and future availability, retaining known undated material", () => {
    const items = [
      evidence(),
      evidence({ id: "future", publishedAt: "2027-01-01" }),
      evidence({ id: "learned-later", availableAt: "2027-01-01" }),
      evidence({ id: "undated", publishedAt: null }),
      evidence({ id: "bad", availableAt: "invalid" }),
    ];
    expect(selectInterviewEvidence(items, "2025-01-01", 8000).map(e => e.id)).toEqual([
      "p1",
      "undated",
    ]);
  });
  it("pins corrections and answers before ranked material and respects UTF-8 budget", () => {
    const answer = evidence({
      id: "answer",
      kind: "answer",
      text: "Previously: I already explained the room.",
    });
    const fix = evidence({
      id: "fix",
      kind: "correction",
      text: "WRONG: drums alone. CORRECTION: with a drummer.",
    });
    const items = [evidence({ text: "é".repeat(1200) }), answer, fix, evidence({ id: "small" })];
    const selected = selectInterviewEvidence(items, "2026-01-01", 900);
    expect(selected.map(e => e.id)).toEqual(["fix", "answer", "small"]);
    expect(Buffer.byteLength(JSON.stringify(selected), "utf8")).toBeLessThanOrEqual(900);
  });
  it("fails if correction/answer memory cannot fit rather than silently forgetting it", () => {
    expect(() =>
      selectInterviewEvidence(
        [evidence({ kind: "correction", text: "x".repeat(3000) })],
        "2025-01-01",
        500,
      ),
    ).toThrow(/memory/i);
  });
  it("keeps one copy of evidence, permits two different passages from one source", () => {
    expect(
      selectInterviewEvidence([evidence(), evidence(), evidence({ id: "p2" })], "2025-01-01", 3000),
    ).toHaveLength(2);
  });
});

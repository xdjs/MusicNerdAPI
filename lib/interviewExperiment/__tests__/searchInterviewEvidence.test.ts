import { describe, expect, it } from "vitest";
import { searchInterviewEvidence } from "@/lib/interviewExperiment/searchInterviewEvidence";
import { evidence } from "./evidence";
describe("searchInterviewEvidence", () => {
  it("finds older evidence beyond the recent window", () => {
    const items = [
      evidence({ id: "new", text: "New song out now", publishedAt: "2026-01-01" }),
      evidence({ id: "old", text: "My drum recording in a stairwell" }),
    ];
    expect(searchInterviewEvidence(items, "drum stairwell", "2026-02-01").map(e => e.id)).toEqual([
      "old",
    ]);
  });
  it("never retrieves future, duplicate, or irrelevant sources", () => {
    const old = evidence();
    expect(
      searchInterviewEvidence(
        [old, old, evidence({ id: "future", availableAt: "2027-01-01" })],
        "drums",
        "2025-01-01",
      ),
    ).toHaveLength(1);
    expect(searchInterviewEvidence([old], "bananas", "2025-01-01")).toEqual([]);
  });
  it("caps results and handles Unicode queries", () => {
    expect(
      searchInterviewEvidence(
        Array.from({ length: 20 }, (_, i) =>
          evidence({ id: String(i), text: "percussão acústica" }),
        ),
        "percussão",
        "2025-01-01",
      ),
    ).toHaveLength(6);
  });
});

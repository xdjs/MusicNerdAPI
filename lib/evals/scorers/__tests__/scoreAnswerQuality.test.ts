import { describe, it, expect } from "vitest";
import { scoreAnswerQuality } from "@/lib/evals/scorers/scoreAnswerQuality";

describe("scoreAnswerQuality", () => {
  it("turns the judge's verdict into a relevance and a groundedness score, reason attached", () => {
    expect(
      scoreAnswerQuality({ relevance: 1, groundedness: 0.5, reason: "one claim unsupported" }),
    ).toEqual([
      { name: "answer_relevance", score: 1, metadata: { reason: "one claim unsupported" } },
      { name: "answer_groundedness", score: 0.5, metadata: { reason: "one claim unsupported" } },
    ]);
  });

  it("clamps a judge number outside 0 to 1", () => {
    const [relevance, groundedness] = scoreAnswerQuality({
      relevance: 1.4,
      groundedness: -0.2,
      reason: "",
    });
    expect(relevance.score).toBe(1);
    expect(groundedness.score).toBe(0);
  });
});

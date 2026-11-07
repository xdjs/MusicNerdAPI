import { expect, it } from "vitest";
import { scoreFirstPassage } from "./scoreFirstPassage";
it("records raw latency without inventing approved threshold", () => {
  expect(
    scoreFirstPassage({
      firstPassageMs: 43,
      attribution: { state: "complete-transport" },
    }),
  ).toEqual({
    name: "first_substantive_passage",
    score: null,
    metadata: {
      firstPassageMs: 43,
      thresholdMs: null,
      approvalReference: null,
      status: "blocked_missing_approved_threshold",
    },
  });
});
it("never substitutes first-text timing", () => {
  expect(scoreFirstPassage({})).toBeNull();
});
it("does not accept incomplete transport even with approved threshold", () => {
  expect(
    scoreFirstPassage(
      { firstPassageMs: 5, attribution: { state: "partial" } },
      { thresholdMs: 10, approvalReference: "fixture-only" },
    )?.score,
  ).toBeNull();
});
it("scores only against supplied approved threshold", () => {
  expect(
    scoreFirstPassage(
      { firstPassageMs: 12, attribution: { state: "complete-transport" } },
      { thresholdMs: 10, approvalReference: "fixture-only" },
    )?.score,
  ).toBe(0);
});

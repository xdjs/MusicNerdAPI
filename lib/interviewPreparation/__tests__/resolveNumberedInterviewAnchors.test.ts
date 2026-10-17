import { expect, it } from "vitest";
import {
  resolveNumberedInterviewAnchors,
  type NumberedInterviewEvidence,
} from "../resolveNumberedInterviewAnchors";
const evidence: NumberedInterviewEvidence[] = [
  {
    anchor: { kind: "original", sourceId: "vault:canonical", revision: "a".repeat(64) },
    text: "The artist made a recording.",
  },
  {
    anchor: { kind: "answer", entryId: "answer:canonical", revision: "b".repeat(64) },
    text: "I recorded the whole session.",
  },
];
it("supplies source IDs and revisions from the host only", () => {
  expect(
    resolveNumberedInterviewAnchors([{ evidenceId: 0, quote: "made a recording" }], evidence),
  ).toEqual([{ ...evidence[0].anchor, quote: "made a recording" }]);
  expect(
    resolveNumberedInterviewAnchors(
      [{ evidenceId: 1, quote: "recorded the whole session" }],
      evidence,
    )[0],
  ).toMatchObject({ entryId: "answer:canonical", revision: "b".repeat(64) });
});
it.each([-1, 2, 0.5, undefined])("rejects missing or invalid evidence index %s", evidenceId => {
  expect(() =>
    resolveNumberedInterviewAnchors(
      [{ evidenceId: evidenceId as number, quote: "made a recording" }],
      evidence,
    ),
  ).toThrow("Original reference mismatch");
});
it("rejects an invented quote instead of guessing another source", () => {
  expect(() =>
    resolveNumberedInterviewAnchors([{ evidenceId: 0, quote: "invented recording" }], evidence),
  ).toThrow("Original reference mismatch");
});

import { expect, it } from "vitest";
import { DRAFT_SCHEMA, SEARCH_SCHEMA } from "@/lib/interviewExperiment/const";
it("does not discard an entire paid response because a rationale or exact quote is verbose", () => {
  expect(
    SEARCH_SCHEMA.safeParse({
      leads: [{ sourceIds: ["e1"], query: "drums", whyInvestigate: "word ".repeat(120) }],
    }).success,
  ).toBe(true);
  expect(
    DRAFT_SCHEMA.safeParse({
      questions: [
        {
          question: "What changed?",
          whyAsk: "A choice",
          unknown: "The effect",
          evidence: [{ evidenceId: "e1", quote: "Original source phrase ".repeat(30) }],
        },
      ],
    }).success,
  ).toBe(true);
});

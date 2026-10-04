import { describe, expect, it } from "vitest";
import { validateInterviewDraft } from "@/lib/interviewExperiment/validateInterviewDraft";
import { evidence } from "./evidence";
const draft = {
  question: "What did the stairwell change about those drums?",
  whyAsk: "A recording decision.",
  unknown: "The musical effect.",
  evidence: [{ evidenceId: "p1", quote: "I recorded drums alone in a stairwell." }],
};
describe("validateInterviewDraft", () => {
  it("accepts an exact original excerpt", () =>
    expect(validateInterviewDraft(draft, [evidence()])).toBeNull());
  it("rejects fabricated identifiers and quote drift", () => {
    expect(
      validateInterviewDraft({ ...draft, evidence: [{ evidenceId: "invented", quote: "drums" }] }, [
        evidence(),
      ]),
    ).toMatch(/unknown/i);
    expect(
      validateInterviewDraft(
        { ...draft, evidence: [{ evidenceId: "p1", quote: "I recorded bass" }] },
        [evidence()],
      ),
    ).toMatch(/quote/);
  });
  it("rejects padding with empty or tiny quotes", () =>
    expect(
      validateInterviewDraft({ ...draft, evidence: [{ evidenceId: "p1", quote: "I" }] }, [
        evidence(),
      ]),
    ).toMatch(/quote/));
  it("requires evidence and an unanswered angle", () => {
    expect(validateInterviewDraft({ ...draft, evidence: [] }, [evidence()])).toMatch(/evidence/);
    expect(validateInterviewDraft({ ...draft, unknown: "" }, [evidence()])).toMatch(/unknown/i);
  });
});

it("accepts layout-only whitespace differences in PDF quotes but rejects added words", () => {
  const src = evidence({ text: "I recorded\n\ndrums alone in a stairwell." });
  expect(validateInterviewDraft(draft, [src])).toBeNull();
  expect(
    validateInterviewDraft(
      {
        ...draft,
        evidence: [{ evidenceId: "p1", quote: "I recorded drums alone in a large stairwell." }],
      },
      [src],
    ),
  ).toMatch(/quote/);
});

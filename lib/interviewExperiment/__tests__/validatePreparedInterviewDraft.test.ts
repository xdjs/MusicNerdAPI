import { expect, it } from "vitest";
import { validatePreparedInterviewDraft } from "../validatePreparedInterviewDraft";
import { evidence } from "./evidence";
const source = evidence();
const draft = {
  question: "What did the stairwell change about your playing?",
  whyAsk: "Musical detail",
  unknown: "Playing choice",
  evidence: [{ evidenceId: source.id, quote: source.text }],
};
it("rejects invented direct quotations in the spoken question even when the support is real", () => {
  expect(
    validatePreparedInterviewDraft(
      { ...draft, question: 'Why did you call it "a hypnotic and insistent effect"?' },
      [source],
    ),
  ).toMatch(/quotation/i);
  expect(validatePreparedInterviewDraft(draft, [source])).toBeNull();
});
it("rejects sprawling or multiple spoken questions", () => {
  expect(
    validatePreparedInterviewDraft({ ...draft, question: "Tell me more? What happened next?" }, [
      source,
    ]),
  ).toMatch(/one/i);
  expect(
    validatePreparedInterviewDraft({ ...draft, question: "word ".repeat(41) + "?" }, [source]),
  ).toMatch(/40/);
});

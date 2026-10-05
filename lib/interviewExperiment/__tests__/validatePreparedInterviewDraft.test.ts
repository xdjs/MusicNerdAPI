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
it("rejects two interrogatives joined with a conjunction, even with one question mark", () => {
  for (const question of [
    "What did you give the remixers, and how much direction did you offer?",
    "Which beat did you choose—and what drew you to it?",
    "What did you bring in; what did the producer add?",
  ]) {
    expect(validatePreparedInterviewDraft({ ...draft, question }, [source])).toMatch(/one/i);
  }
  expect(
    validatePreparedInterviewDraft(
      { ...draft, question: "How did drums and bass shape the arrangement?" },
      [source],
    ),
  ).toBeNull();
});
it("allows typographic terminal punctuation in a title but still rejects invented words", () => {
  const record = evidence({ text: "I recorded the track Silver Afternoon in that stairwell." });
  const supported = { ...draft, evidence: [{ evidenceId: record.id, quote: record.text }] };
  expect(
    validatePreparedInterviewDraft(
      { ...supported, question: 'How did you record "Silver Afternoon," in that room?' },
      [record],
    ),
  ).toBeNull();
  expect(
    validatePreparedInterviewDraft(
      { ...supported, question: 'How did you record "Golden Afternoon," in that room?' },
      [record],
    ),
  ).toMatch(/quotation/i);
});

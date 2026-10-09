import { expect, it } from "vitest";
import { parseQuestionResearchState } from "@/lib/questionResearch/parseQuestionResearchState";
const state = {
  version: 1,
  savedOnly: true,
  key: "key",
  expectedClaimId: null,
  createdAt: "2026-10-09T00:00:00Z",
  stage: "checking_saved",
  references: [],
  limitations: [],
  modelCalls: 2,
  providerCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  request: { topic: "other projects", evidenceNeed: "reporting", freshness: "stored" },
};
it("allows only one recorded structured-output retry within the saved-only model ceiling", () => {
  expect(parseQuestionResearchState({ ...state, outputRetries: 1 }).modelCalls).toBe(2);
  for (const outputRetries of [-1, 2, 0.5, "1", null])
    expect(() => parseQuestionResearchState({ ...state, outputRetries })).toThrow();
  expect(() => parseQuestionResearchState(state)).toThrow();
  expect(() => parseQuestionResearchState({ ...state, modelCalls: 3, outputRetries: 1 })).toThrow();
  expect(() =>
    parseQuestionResearchState({ ...state, outputRetries: 1, providerCalls: 1 }),
  ).toThrow();
});

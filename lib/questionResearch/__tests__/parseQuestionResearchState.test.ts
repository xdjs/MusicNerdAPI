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
  modelCalls: 6,
  providerCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  request: { topic: "other projects", evidenceNeed: "reporting", freshness: "stored" },
};
it("allows only one recorded structured-output retry within the saved-only model ceiling", () => {
  expect(parseQuestionResearchState({ ...state, outputRetries: 1 }).modelCalls).toBe(6);
  for (const outputRetries of [-1, 2, 0.5, "1", null])
    expect(() => parseQuestionResearchState({ ...state, outputRetries })).toThrow();
  expect(() => parseQuestionResearchState(state)).toThrow();
  expect(() => parseQuestionResearchState({ ...state, modelCalls: 7, outputRetries: 1 })).toThrow();
  expect(() =>
    parseQuestionResearchState({ ...state, outputRetries: 1, providerCalls: 1 }),
  ).toThrow();
});
it("keeps candidate readiness separate from model-assessed research and rejects malformed markers", () => {
  const candidate = {
    ...state,
    modelCalls: 0,
    stage: "complete",
    selection: "candidates",
    directAttempted: true,
  };
  expect(parseQuestionResearchState(candidate)).toMatchObject({
    selection: "candidates",
    directAttempted: true,
  });
  for (const patch of [
    { selection: "sufficient" },
    { directAttempted: false },
    { directAttempted: undefined },
    { selection: undefined },
    { stage: "checking_saved" },
    { modelCalls: 1 },
    { providerCalls: 1 },
    { plan: { provider: null, stage: "unresolved", reason: "missing" } },
    { inFlight: "model" },
  ])
    expect(() => parseQuestionResearchState({ ...candidate, ...patch })).toThrow();
  expect(
    parseQuestionResearchState({ ...candidate, selection: "research", stage: "checking_saved" }),
  ).toMatchObject({ selection: "research" });
});

it("requires a valid outside reservation for every new-budget external stage", () => {
  const initial = { ...state, modelCalls: 0, savedOnly: undefined, budgetVersion: 2 };
  expect(parseQuestionResearchState(initial).budgetVersion).toBe(2);
  for (const patch of [
    { step: "search" },
    { providerCalls: 1 },
    { inFlight: "social_start" },
    { outsideReservedAt: "bad" },
    { budgetVersion: 3 },
    { outsideReservedAt: "2026-10-15T12:00:00Z", savedOnly: true },
  ])
    expect(() => parseQuestionResearchState({ ...initial, ...patch })).toThrow();
  expect(
    parseQuestionResearchState({
      ...initial,
      step: "search",
      outsideReservedAt: "2026-10-15T12:00:00Z",
    }),
  ).toMatchObject({ budgetVersion: 2 });
});

it("validates optional facet coverage against the request order and finalized references", () => {
  const faceted = {
    ...state,
    modelCalls: 1,
    stage: "complete",
    request: {
      topic: "Artist; early records; later albums",
      evidenceNeed: "reporting",
      freshness: "stored",
      evidenceFacets: [
        { id: "f1", intent: "early records" },
        { id: "f2", intent: "later albums" },
      ],
    },
    references: [{ sourceId: "a" }, { sourceId: "b" }],
    facetCoverage: [
      { id: "f1", referenceIndexes: [0] },
      { id: "f2", referenceIndexes: [1] },
    ],
  };
  expect(parseQuestionResearchState(faceted).facetCoverage).toEqual(faceted.facetCoverage);
  for (const facetCoverage of [
    [
      { id: "f2", referenceIndexes: [1] },
      { id: "f1", referenceIndexes: [0] },
    ],
    [
      { id: "f1", referenceIndexes: [2] },
      { id: "f2", referenceIndexes: [1] },
    ],
    [
      { id: "f1", referenceIndexes: [0, 0] },
      { id: "f2", referenceIndexes: [1] },
    ],
    [{ id: "f1", referenceIndexes: [0] }],
  ])
    expect(() => parseQuestionResearchState({ ...faceted, facetCoverage })).toThrow();
  expect(() => parseQuestionResearchState({ ...state, facetCoverage: [] })).toThrow();
  expect(parseQuestionResearchState({ ...faceted, facetCoverage: undefined }).facetCoverage).toBe(
    undefined,
  );
});

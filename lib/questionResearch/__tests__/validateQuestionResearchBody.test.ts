import { it, expect } from "vitest";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";
const base = { topic: "Album release date", evidenceNeed: "release_date" };
it("accepts bounded neutral evidence requests and defaults stored-first freshness", () => {
  expect(validateQuestionResearchBody(base)).toEqual({ ...base, freshness: "stored" });
});
it("rejects unknown actor, account and budget inputs", () => {
  for (const key of ["actor", "accountId", "maxItems", "question"])
    expect(() => validateQuestionResearchBody({ ...base, [key]: "anything" })).toThrow();
});
it("rejects unbounded and reversed publication-date requests", () => {
  expect(() => validateQuestionResearchBody({ ...base, topic: "a".repeat(161) })).toThrow();
  expect(() =>
    validateQuestionResearchBody({ ...base, fromDate: "2026-10-06", toDate: "2026-10-01" }),
  ).toThrow();
  expect(() => validateQuestionResearchBody({ ...base, fromDate: "2026-02-30" })).toThrow();
});
it("validates an explicit latest retrieval mode without changing the default", () => {
  expect(validateQuestionResearchBody({ ...base, retrieval: "latest" }).retrieval).toBe("latest");
  expect(() => validateQuestionResearchBody({ ...base, retrieval: "all" })).toThrow();
});

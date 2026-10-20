import { describe, expect, it } from "vitest";
import { isCrossRecordSonicComparison } from "@/lib/questionResearch/isCrossRecordSonicComparison";
import type { ResearchRequest } from "@/lib/questionResearch/types";

const request = (overrides: Partial<ResearchRequest> = {}): ResearchRequest => ({
  topic: "Marlowe Echo; sound changed since early records",
  evidenceNeed: "reporting",
  freshness: "stored",
  ...overrides,
});

describe("isCrossRecordSonicComparison", () => {
  it.each([
    "Marlowe Echo; sound changed since early records",
    "Marlowe Echo; compare the sound between the debut and second albums",
    "Marlowe Echo; how did the arrangement shift across early and later records?",
  ])("routes explicit multi-record sonic comparison: %s", topic => {
    expect(isCrossRecordSonicComparison(request({ topic }))).toBe(true);
  });

  it.each([
    "Marlowe Echo; how has the sound changed since that interview?",
    "Marlowe Echo; compare the mix of two versions of one song",
    "Marlowe Echo; recording setup changes across early albums",
    "Marlowe Echo; record label changes since 2020",
    "Marlowe Echo; how has the music career changed since early records?",
    "Marlowe Echo; do not compare sound across early records, describe label changes",
  ])("does not route a non-cross-record or non-sonic request: %s", topic => {
    expect(isCrossRecordSonicComparison(request({ topic }))).toBe(false);
  });

  it("leaves latest and exact-URL requests on their existing path", () => {
    expect(isCrossRecordSonicComparison(request({ retrieval: "latest" }))).toBe(false);
    expect(isCrossRecordSonicComparison(request({ targetUrl: "https://example.com/source" }))).toBe(
      false,
    );
  });

  it("only routes reporting requests", () => {
    expect(isCrossRecordSonicComparison(request({ evidenceNeed: "credits" }))).toBe(false);
  });
});

import { it, expect } from "vitest";
import { researchRequestKey } from "@/lib/questionResearch/researchRequestKey";
it("never reuses a failed lexical query for a new chronological overview", () => {
  const request = {
    topic: "latest updates",
    evidenceNeed: "reporting",
    freshness: "stored",
  } as const;
  expect(researchRequestKey({ ...request, retrieval: "latest" })).not.toBe(
    researchRequestKey(request),
  );
  expect(researchRequestKey({ ...request, retrieval: "relevance" })).toBe(
    researchRequestKey(request),
  );
});
it("keys exclusions as a canonical set and preserves legacy keys when empty", () => {
  const request = {
    topic: "other updates",
    evidenceNeed: "reporting",
    freshness: "stored",
  } as const;
  const a = "https://example.com/one";
  const b = "https://example.com/two";
  expect(researchRequestKey({ ...request, excludeSourceUrls: [a, b, a] })).toBe(
    researchRequestKey({ ...request, excludeSourceUrls: [b, a] }),
  );
  expect(researchRequestKey({ ...request, excludeSourceUrls: [a] })).not.toBe(
    researchRequestKey(request),
  );
  expect(researchRequestKey({ ...request, excludeSourceUrls: [] })).toBe(
    researchRequestKey(request),
  );
});

import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
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

it("separates an overview from focused cached evidence and preserves omitted scope identity", () => {
  const request = {
    topic: "latest updates",
    evidenceNeed: "reporting",
    freshness: "stored",
    retrieval: "latest",
  } as const;
  expect(researchRequestKey({ ...request, answerScope: "overview" })).not.toBe(
    researchRequestKey(request),
  );
  expect(researchRequestKey({ ...request, answerScope: "focused" })).toBe(
    researchRequestKey(request),
  );
});
it("does not reuse a different positive evidence-facet decomposition", () => {
  const request = {
    topic: "Tom Vek; early records and their sound; later albums and their production",
    evidenceNeed: "reporting",
    freshness: "stored",
  } as const;
  const facets = [
    { id: "f1" as const, intent: "early records and their sound" },
    { id: "f2" as const, intent: "later albums and their production" },
  ];
  expect(researchRequestKey({ ...request, evidenceFacets: facets })).not.toBe(
    researchRequestKey(request),
  );
  expect(
    researchRequestKey({
      ...request,
      evidenceFacets: [{ id: "f1", intent: "early records and their sound" }],
    }),
  ).not.toBe(
    researchRequestKey({
      ...request,
      evidenceFacets: [{ id: "f1", intent: "another positive requirement" }],
    }),
  );
  expect(researchRequestKey(request)).toBe(
    researchRequestKey({ ...request, evidenceFacets: undefined }),
  );
});
it("versions all evidence so cached cutoff results are reassessed", () => {
  const request = {
    topic: "latest updates",
    evidenceNeed: "reporting",
    freshness: "stored",
    retrieval: "latest",
    answerScope: "overview",
  } as const;
  const old = knowledgeRevision([
    "latest updates",
    "reporting",
    "stored",
    null,
    null,
    null,
    null,
    "latest",
    "overview",
  ]);
  expect(researchRequestKey(request)).not.toBe(old);
  expect(researchRequestKey({ ...request, answerScope: "focused" })).not.toBe(
    knowledgeRevision(["latest updates", "reporting", "stored", null, null, null, null, "latest"]),
  );
});

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

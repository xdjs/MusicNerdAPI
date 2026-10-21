import { expect, it } from "vitest";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { parseResearchRouting } from "@/lib/questionResearch/parseResearchRouting";

it("returns the bounded request the research endpoint would have accepted", () => {
  expect(
    parseResearchRouting({ topic: "drum credits", evidenceNeed: "credits", freshness: "stored" }),
  ).toEqual({ topic: "drum credits", evidenceNeed: "credits", freshness: "stored" });
});

it("refuses unknown fields, out-of-bounds values and oversized routing with a 400", () => {
  for (const routing of [
    { topic: "drum credits", evidenceNeed: "credits", accountId: "x" },
    { topic: "x", evidenceNeed: "credits" },
    { topic: "drum credits", evidenceNeed: "credits", excludeSourceUrls: ["a".repeat(4100)] },
  ])
    expect(() => parseResearchRouting(routing)).toThrow(
      expect.objectContaining({ status: 400, code: "invalid_request" }) as KnowledgeError,
    );
});

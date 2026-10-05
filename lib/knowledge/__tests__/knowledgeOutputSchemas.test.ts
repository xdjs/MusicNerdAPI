import { describe, expect, it } from "vitest";
import { knowledgeOutputSchemas } from "@/lib/knowledge/knowledgeOutputSchemas";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { answer, correction, rawKnowledge, social, vault } from "./fixtures";

describe("public knowledge response contracts", () => {
  it("validates actual metadata, speech, long history, and partial reads for every operation", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [vault],
      social: [social],
      answers: [answer],
      corrections: [correction],
    });
    const source = snapshot.sources[0].metadata;
    const queries = [
      { operation: "brief" },
      { operation: "sources", limit: 1 },
      { operation: "search", query: "attention", limit: 5, maxChars: 1000 },
      {
        operation: "read",
        sourceId: source.sourceId,
        revision: source.revision,
        start: 0,
        maxChars: 1000,
      },
      { operation: "history", kind: "all", limit: 1, maxChars: 1000 },
      { operation: "research-status", limit: 20 },
    ] as const;
    for (const input of queries)
      expect(
        knowledgeOutputSchemas[input.operation].safeParse(queryArtistKnowledge(snapshot, input))
          .success,
      ).toBe(true);
  });
});

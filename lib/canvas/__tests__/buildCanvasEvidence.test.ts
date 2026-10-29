import { expect, it } from "vitest";
import { buildCanvasEvidence } from "../buildCanvasEvidence";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
it("renders InProcess description rather than storage JSON, without inferring an event date", () => {
  const item = buildCanvasEvidence({
    ...originalFixture("source", "https://example.com", "text"),
    sourceId: "test",
    url: "https://www.inprocess.world/collect/example/1",
    text: JSON.stringify({
      title: "A work",
      description: "A first person description of making this piece.",
      created_at: "2026-10-01",
    }),
    publishedAt: null,
  });
  expect(item?.title).toBe("A work");
  expect(item?.text).toBe("A first person description of making this piece.");
  expect(item?.date).toBeNull();
  expect(item?.text).not.toContain("created_at");
});
it("bounds excerpts and rejects non-web source links", () => {
  const source = {
    ...originalFixture("source", "https://example.com", "text"),
    text: "word ".repeat(100),
  };
  expect(buildCanvasEvidence(source)?.text.split(/\s+/)).toHaveLength(25);
  expect(buildCanvasEvidence({ ...source, url: "javascript:alert(1)" })).toBeNull();
});

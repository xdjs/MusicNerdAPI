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
it("selects a focused passage and reconstructs it without accepting client text", () => {
  const source = originalFixture(
    "vault:focused",
    "https://example.com",
    "Unrelated introduction. ".repeat(80) +
      "Improvisation became a daily practice through recording unfinished ideas and returning to them later.",
  );
  const item = buildCanvasEvidence(source, "improvisation daily practice");
  expect(item?.text).toContain("Improvisation");
  expect(item?.id).toMatch(/::excerpt:\d+$/);
  const offset = Number(item!.id.split("::excerpt:")[1]);
  expect(buildCanvasEvidence(source, offset)).toEqual(item);
});
it("uses a stored release activity date without relabeling it as a post date", () => {
  const item = buildCanvasEvidence({
    ...originalFixture("latest:release", "https://example.com", "Release metadata"),
    activityDate: "2024-03",
    activityDateKind: "release",
  });
  expect(item?.date).toBe("2024-03");
  expect(item?.dateKind).toBe("Release date from stored provider record");
});
it("does not call a provider transcript a caption or hide pending review", () => {
  const item = buildCanvasEvidence({
    ...originalFixture(
      "social:transcript",
      "https://www.instagram.com/reel/example/",
      "Provider transcript text.",
    ),
    evidenceKind: "provider_transcript",
    curation: "pending",
    truncated: true,
  });
  expect(item?.attribution).toBe("Instagram · stored provider transcript");
  expect(item?.limitation).toContain("Speaker attribution is unverified");
  expect(item?.limitation).toContain("pending review");
  expect(item?.limitation).toContain("extraction is truncated");
});
it("retains PDF page and document attribution without inventing an event date", () => {
  const item = buildCanvasEvidence({
    ...originalFixture(
      "public_pdf:test:page:7",
      "https://example.com/book.pdf#page=7",
      "An original page passage.",
    ),
    pdf: { page: 7, title: "Archive · PDF p. 7", limitation: "Narrator is not the artist." },
  });
  expect(item).toMatchObject({
    page: 7,
    title: "Archive · PDF p. 7",
    category: "document",
    date: null,
  });
  expect(item?.limitation).toContain("Narrator is not the artist.");
});

it("never begins a passage inside a word and rehydrates its stable boundary", () => {
  const source = originalFixture(
    "pdf:page",
    "https://example.com",
    "opening extraordinary passage with Evolving Portals and patient listening",
  );
  const item = buildCanvasEvidence(source, 11);
  expect(item?.text).toBe("passage with Evolving Portals and patient listening");
  expect(item?.id).toBe("pdf:page::excerpt:11");
  const offset = Number(item!.id.split("::excerpt:")[1]);
  expect(buildCanvasEvidence(source, offset)).toEqual(item);
});

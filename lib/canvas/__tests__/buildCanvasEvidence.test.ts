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

it("selects the foreword speaker rather than the preceding first-person preface", () => {
  const source = {
    ...originalFixture(
      "pdf:mixed",
      "https://example.com/a.pdf#page=1",
      "Preface (by Artist)\n“I am building something lasting, something that reflects my own life and everything in between.”\nForeword (by Guest Writer)\nThe artist documents a creative life in this archive.",
    ),
    pdf: { page: 1, title: "Archive", limitation: "Different labeled speakers." },
  };
  const item = buildCanvasEvidence(source, "Who wrote the foreword? Guest Writer or Artist?");
  expect(item?.text).toContain("Foreword (by Guest Writer)");
  expect(item?.text).not.toContain("I am building");
  expect(item?.category).toBe("document");
});
it("selects the date and credit lines instead of Bandcamp purchase navigation", () => {
  const source = originalFixture(
    "bandcamp:album",
    "https://artist.bandcamp.com/album/night",
    "NIGHT | Artist\nBuy Digital Album 10 USD Full Digital Discography 7 releases Get all albums NIGHT and DAY streaming downloads.\nabout\nA new record.\ncredits\nreleased March 5, 2021\nProduced and written Artist\nlicense\nall rights reserved tags electronic",
  );
  const item = buildCanvasEvidence(source, "Who produced NIGHT and when was it released?");
  expect(item?.text).toContain("March 5, 2021");
  expect(item?.text).toContain("Produced and written Artist");
  expect(item?.text).not.toContain("USD");
  expect(item?.title).toBe("NIGHT");
  expect(item?.date).toBeNull();
});
it("retains recording and release distinctions without assigning either to the source date", () => {
  const source = originalFixture(
    "pdf:dates",
    "https://example.com/a.pdf",
    "2004 Album. CD Vinyl Digital. First solo full-length. Recorded 1997-2002, released July 13, 2004. Produced by the artist and collaborators.",
  );
  const item = buildCanvasEvidence(source, "When was Album recorded and released?");
  expect(item?.text).toContain("Recorded 1997-2002, released July 13, 2004");
  expect(item?.date).toBeNull();
});

it("skips verified repeated archive headings without rewriting the cited passage or old offsets", () => {
  const source = {
    ...originalFixture(
      "public_pdf:dutch-archive:abcdef123456:page:7",
      "https://example.com/archive.pdf#page=7",
      "Earlier archival context on the same physical page.\nDutchyyy vs The Algorithms (Excerpt)\nThe Creation of Evolving Portals and Long-Form Art\nWhile algorithms encouraged short-form content, Dutchyyy rebelled by focusing on long-form, immersive projects.\nEvolving Portals, an ongoing series of experimental music pieces, defied the norm with hours of creative output that rewarded deep listening and exploration.",
    ),
    pdf: {
      page: 7,
      title: "Published archive · PDF p. 7",
      limitation: "Narration is not artist testimony.",
    },
  };
  const item = buildCanvasEvidence(source, "Evolving Portals archive passage");
  expect(item?.text).not.toContain("The Algorithms");
  expect(item?.text).not.toContain("The Creation");
  expect(item?.text).toContain("Evolving Portals");
  expect(source.text.replace(/\s+/g, " ")).toContain(item!.text);
  expect(item!.text.split(/\s+/).length).toBeLessThanOrEqual(25);
  expect(item?.date).toBeNull();
  expect(item?.limitation).toContain("Narration is not artist testimony");
  expect(buildCanvasEvidence(source, Number(item!.id.split("::excerpt:")[1]))).toEqual(item);
  expect(buildCanvasEvidence(source, 0)?.text).toContain("Earlier archival context");
});

it("does not select an archive footer just because the document title matches it", () => {
  const source = {
    ...originalFixture(
      "public_pdf:dutch-archive:hash:page:14",
      "https://example.com/a.pdf#page=14",
      "Chapter I (2015-2016) began with the intention to write his next album.\nIn June 2023, he released all 283 minutes of the DailyRambles series.\nAlthough he never intended to make this vulnerable body of\n54\nDutchyyyDutchyyy -vs- The Algorithms",
    ),
    pdf: {
      page: 14,
      title: "Dutchyyy vs The Algorithms — published archive excerpt · PDF p. 14",
      limitation: "Archive narration, not artist testimony.",
    },
  };
  expect(buildCanvasEvidence(source)?.text).toContain("Chapter I");
  expect(buildCanvasEvidence(source)?.text).not.toContain("Algorithms");
  expect(buildCanvasEvidence(source, "June 2023 released")?.text).toContain("June 2023");
});

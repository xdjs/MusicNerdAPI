import { it, expect } from "vitest";
import { extractPublicationDate } from "@/lib/sourceExtraction/extractPublicationDate";
it("reads only explicit page publication metadata and preserves precision", () => {
  expect(
    extractPublicationDate(
      '<meta property="article:published_time" content="2026-10-08T12:00:00-04:00">',
    ),
  ).toBe("2026-10-08T12:00:00-04:00");
  expect(extractPublicationDate('<meta content="2026-10-08" name="datePublished">')).toBe(
    "2026-10-08",
  );
});
it("does not substitute upload, modification, event, copyright or body dates", () => {
  expect(
    extractPublicationDate(
      '<meta property="article:modified_time" content="2026-10-08"><time datetime="2026-10-08">Show tonight</time><p>Published October 8, 2026</p>',
    ),
  ).toBeNull();
});
it("refuses malformed and conflicting publication dates", () => {
  expect(
    extractPublicationDate('<meta property="article:published_time" content="2026-02-30">'),
  ).toBeNull();
  expect(
    extractPublicationDate(
      '<meta property="article:published_time" content="2026-10-08"><meta name="datePublished" content="2026-10-09">',
    ),
  ).toBeNull();
});
it("does not treat a body-injected meta as the page publication metadata", () => {
  expect(
    extractPublicationDate(
      '<html><head></head><body><article><meta property="article:published_time" content="2026-10-08">Story</article></body></html>',
    ),
  ).toBeNull();
});

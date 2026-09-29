import { describe, it, expect } from "vitest";
import { extractPublishedDate } from "@/lib/pages/extractPublishedDate";

const NOW = new Date("2026-08-22T00:00:00Z");

describe("extractPublishedDate", () => {
  it("reads article:published_time, and attributes in either order", () => {
    expect(
      extractPublishedDate(
        '<meta property="article:published_time" content="2019-01-10T14:00:00+00:00">',
        NOW,
      ),
    ).toBe("2019-01-10");
    expect(extractPublishedDate('<meta content="2024-01-24" name="date">', NOW)).toBe("2024-01-24");
  });

  it("reads datePublished out of JSON-LD", () => {
    const html = `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2019-01-10T09:30:00Z"}</script>`;
    expect(extractPublishedDate(html, NOW)).toBe("2019-01-10");
  });

  it("prefers a meta date over <time>, and falls back to <time>", () => {
    expect(
      extractPublishedDate(
        '<meta property="article:published_time" content="2019-01-10"><time datetime="2026-08-01">today</time>',
        NOW,
      ),
    ).toBe("2019-01-10");
    expect(extractPublishedDate('<time datetime="2022-06-05">June</time>', NOW)).toBe("2022-06-05");
  });

  it("returns null rather than a guess", () => {
    expect(extractPublishedDate("<html><body><p>Filters.</p></body></html>", NOW)).toBeNull();
    expect(extractPublishedDate('<meta name="date" content="2099-01-01">', NOW)).toBeNull();
    expect(extractPublishedDate('<meta name="date" content="1900-01-01">', NOW)).toBeNull();
    expect(extractPublishedDate('<meta name="date" content="not a date">', NOW)).toBeNull();
  });

  it("skips an unparseable candidate and takes the next real one", () => {
    const html =
      '<meta property="article:published_time" content="{{date}}"><meta name="date" content="2021-03-04">';
    expect(extractPublishedDate(html, NOW)).toBe("2021-03-04");
  });
});

import { describe, it, expect } from "vitest";
import { stripUrlQuery } from "@/lib/discovery/stripUrlQuery";

describe("stripUrlQuery: tracking params are not part of a handle", () => {
  it("drops the query string and fragment a search result carries", () => {
    expect(stripUrlQuery("https://www.instagram.com/p3t3rango/?hl=en")).toBe(
      "https://www.instagram.com/p3t3rango/",
    );
    expect(stripUrlQuery("https://x.com/pete#top")).toBe("https://x.com/pete");
  });

  it("never reformats: a bare Bandcamp domain gets no trailing slash", () => {
    expect(stripUrlQuery("https://peterango.bandcamp.com")).toBe("https://peterango.bandcamp.com");
    expect(stripUrlQuery("not a url")).toBe("not a url");
  });
});

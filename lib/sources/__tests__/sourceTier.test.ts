import { describe, it, expect } from "vitest";
import { sourceTier } from "@/lib/sources/sourceTier";

describe("sourceTier", () => {
  it("calls coverage, credits, an own site and an own feed preferred", () => {
    expect(sourceTier("https://voyagemia.com/interview/x", "interview")).toBe("preferred");
    expect(sourceTier("https://www.discogs.com/artist/1", "profile")).toBe("preferred");
    expect(sourceTier("https://peterango.com", "website", { ownDomain: true })).toBe("preferred");
    expect(sourceTier("https://www.instagram.com/p3t3rango/", "profile")).toBe("preferred");
  });

  it("calls an unplaceable page and a store page unknown", () => {
    expect(sourceTier("https://some-small-zine.example/x", "profile")).toBe("unknown");
    expect(sourceTier("https://some-small-zine.example/feature", "article")).toBe("preferred");
    expect(sourceTier("https://open.spotify.com/artist/abc", "audio")).toBe("unknown");
  });

  it("calls a scraped directory low-signal", () => {
    expect(sourceTier("https://last.fm/user/someone", "profile")).toBe("low-signal");
  });
});

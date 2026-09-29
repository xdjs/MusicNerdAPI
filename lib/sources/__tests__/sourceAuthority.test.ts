import { describe, it, expect } from "vitest";
import { sourceAuthority } from "@/lib/sources/sourceAuthority";
import { AUTHORITY } from "@/lib/sources/const";

describe("sourceAuthority", () => {
  it("puts a credits database above an aggregator profile", () => {
    const discogs = sourceAuthority("https://www.discogs.com/artist/123-Pete-Rango", "profile");
    const clubhouse = sourceAuthority("https://clubhousedb.com/user/peterango", "profile");
    expect(discogs).toBeGreaterThan(clubhouse);
  });

  it("puts editorial coverage at the top", () => {
    expect(sourceAuthority("https://voyagemia.com/interview/meet-peter-rango", "interview")).toBe(
      AUTHORITY.EDITORIAL,
    );
  });

  it("treats an unrecognised publication as unknown, not as junk", () => {
    const zine = sourceAuthority("https://some-small-zine.example/feature", "profile");
    expect(zine).toBe(AUTHORITY.UNKNOWN);
    expect(zine).toBeGreaterThan(sourceAuthority("https://clubhousedb.com/user/x", "profile"));
  });

  it("ranks the artist's own site above their streaming pages", () => {
    expect(
      sourceAuthority("https://peterango.com", "website", { ownDomain: true }),
    ).toBeGreaterThan(sourceAuthority("https://open.spotify.com/artist/abc", "audio"));
  });

  it("ranks their own feed as their own words", () => {
    expect(sourceAuthority("https://www.instagram.com/p3t3rango/")).toBe(AUTHORITY.OWN_WORDS);
  });

  it("is unknown for a URL it cannot parse", () => {
    expect(sourceAuthority("not a url", "interview")).toBe(AUTHORITY.UNKNOWN);
  });
});

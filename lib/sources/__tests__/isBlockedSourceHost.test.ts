import { describe, it, expect } from "vitest";
import { isBlockedSourceHost } from "@/lib/sources/isBlockedSourceHost";

describe("isBlockedSourceHost", () => {
  it("blocks scrape farms and their subdomains", () => {
    for (const url of [
      "https://www.boomplay.com/artists/20993709",
      "https://m.boomplay.com/artists/1",
      "https://www.viberate.com/artist/pharaoh-sistare",
      "https://clubhousedb.com/user/peterango",
      "https://kworb.net/spotify/artist/abc.html",
    ])
      expect(isBlockedSourceHost(url)).toBe(true);
  });

  it("leaves publications, credits databases and stores alone", () => {
    for (const url of [
      "https://www.theguardian.com/music/2026/jan/01/feature",
      "https://www.discogs.com/artist/123-Pete-Rango",
      "https://open.spotify.com/artist/abc",
      "https://some-small-zine.example/feature",
    ])
      expect(isBlockedSourceHost(url)).toBe(false);
  });

  it("says no to an unparseable URL and to look-alike hosts", () => {
    expect(isBlockedSourceHost("not a url")).toBe(false);
    expect(isBlockedSourceHost("")).toBe(false);
    expect(isBlockedSourceHost("https://boomplay.com.evil.example/x")).toBe(false);
    expect(isBlockedSourceHost("https://notboomplay.com/x")).toBe(false);
  });
});

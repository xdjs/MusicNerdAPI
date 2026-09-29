import { describe, it, expect } from "vitest";
import { isMachineFormatUrl } from "@/lib/sources/isMachineFormatUrl";

describe("isMachineFormatUrl", () => {
  it("catches feeds and data files", () => {
    for (const url of [
      "https://rvamag.com/tags/pete/feed",
      "https://rvamag.com/tags/pete/feed/",
      "https://a.example/sitemap.xml",
      "https://a.example/data.JSON?x=1",
      "https://a.example/posts?format=rss",
      "https://a.example/?feed=atom",
    ])
      expect(isMachineFormatUrl(url)).toBe(true);
  });

  it("leaves pages alone", () => {
    expect(isMachineFormatUrl("https://rvamag.com/tags/pete")).toBe(false);
    expect(isMachineFormatUrl("https://a.example/feedback")).toBe(false);
  });
});

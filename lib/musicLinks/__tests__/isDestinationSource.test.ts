import { describe, it, expect } from "vitest";
import { isDestinationSource } from "@/lib/musicLinks/isDestinationSource";

describe("isDestinationSource", () => {
  it("accepts an artist music destination", () => {
    expect(isDestinationSource({ url: "https://music.apple.com/us/artist/pete/123" })).toBe(true);
  });

  it("refuses a release, an audio interview and a podcast episode", () => {
    expect(isDestinationSource({ url: "https://music.apple.com/us/album/x/123" })).toBe(false);
    expect(
      isDestinationSource({ url: "https://soundcloud.com/peterango", type: "interview" }),
    ).toBe(false);
    expect(
      isDestinationSource({
        url: "https://music.apple.com/us/artist/pete/123",
        podcastEpisodeKey: "k",
      }),
    ).toBe(false);
  });

  it("falls back to the main-website rule for other URLs", () => {
    expect(isDestinationSource({ url: "https://peterango.com", type: "website" })).toBe(true);
    expect(isDestinationSource({ url: "https://news.example.com/a", type: "article" })).toBe(false);
  });
});

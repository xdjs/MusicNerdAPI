import { describe, it, expect } from "vitest";
import { artistIdFromUrl } from "@/lib/musicbrainz/artistIdFromUrl";

describe("artistIdFromUrl", () => {
  it("reads the whole path segment after /artist/ on the given host", () => {
    expect(artistIdFromUrl("https://open.spotify.com/artist/ABC", "spotify.com")).toBe("ABC");
    expect(artistIdFromUrl("https://www.deezer.com/en/artist/1234", "deezer.com")).toBe("1234");
  });

  it("is null for another host, no artist segment, or a bad URL", () => {
    expect(artistIdFromUrl("https://www.deezer.com/artist/1", "spotify.com")).toBeNull();
    expect(artistIdFromUrl("https://open.spotify.com/album/X", "spotify.com")).toBeNull();
    expect(artistIdFromUrl("not a url", "spotify.com")).toBeNull();
  });
});

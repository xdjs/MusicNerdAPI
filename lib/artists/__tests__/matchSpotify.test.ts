import { describe, it, expect } from "vitest";
import { matchSpotify } from "@/lib/artists/matchSpotify";

const m = (groups: (string | undefined)[]) => ["full", ...groups] as unknown as RegExpMatchArray;

describe("matchSpotify", () => {
  it("accepts an artist URL with a 22-character base62 id", () => {
    expect(matchSpotify(m(["artist", "0TnOYISbd1XYRBk9myaseg"]), "Spotify")).toEqual({
      siteName: "spotify",
      cardPlatformName: "Spotify",
      id: "0TnOYISbd1XYRBk9myaseg",
    });
    expect(matchSpotify(m(["ARTIST", "0TnOYISbd1XYRBk9myaseg"]), null)?.id).toBe(
      "0TnOYISbd1XYRBk9myaseg",
    );
  });

  it("rejects other URL types and malformed ids", () => {
    expect(matchSpotify(m(["track", "0TnOYISbd1XYRBk9myaseg"]), null)).toBeNull();
    expect(matchSpotify(m(["artist", "short"]), null)).toBeNull();
    expect(matchSpotify(m(["artist", undefined]), null)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { matchPlatformArtistUrl } from "@/lib/musicbrainz/matchPlatformArtistUrl";

const spotifyId = "4Z8W4fKeB5YxbusRsdQVPb";

describe("matchPlatformArtistUrl", () => {
  it("reads a canonical Spotify or Deezer artist URL", () => {
    expect(
      matchPlatformArtistUrl(`https://open.spotify.com/artist/${spotifyId}`, "spotify"),
    ).toEqual({
      status: "valid",
      platformId: spotifyId,
    });
    expect(matchPlatformArtistUrl("https://www.deezer.com/fr/artist/399", "deezer")).toEqual({
      status: "valid",
      platformId: "399",
    });
  });

  it("is unrelated for another host or a non-artist page", () => {
    expect(matchPlatformArtistUrl("https://deezer.com/artist/399", "spotify")).toEqual({
      status: "unrelated",
    });
    expect(
      matchPlatformArtistUrl(`https://open.spotify.com/album/${spotifyId}`, "spotify"),
    ).toEqual({
      status: "unrelated",
    });
  });

  it("is invalid for a malformed id, an extra path, a port or credentials", () => {
    for (const url of [
      "https://open.spotify.com/artist/short",
      `https://open.spotify.com/artist/${spotifyId}/about`,
      `https://open.spotify.com:8443/artist/${spotifyId}`,
      `https://u:p@open.spotify.com/artist/${spotifyId}`,
      "not a url",
    ])
      expect(matchPlatformArtistUrl(url, "spotify")).toEqual({ status: "invalid" });
  });
});

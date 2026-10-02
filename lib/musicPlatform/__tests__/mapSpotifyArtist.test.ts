import { describe, it, expect } from "vitest";
import { mapSpotifyArtist } from "@/lib/musicPlatform/mapSpotifyArtist";

describe("mapSpotifyArtist", () => {
  it("normalizes a Spotify artist", () => {
    expect(
      mapSpotifyArtist(
        {
          id: "sp1",
          name: "Pete Rango",
          images: [{ url: "https://i/1.jpg" }],
          followers: { total: 42 },
          genres: ["soul"],
          external_urls: { spotify: "https://open.spotify.com/artist/sp1" },
        },
        7,
        "Song",
      ),
    ).toEqual({
      platform: "spotify",
      platformId: "sp1",
      name: "Pete Rango",
      imageUrl: "https://i/1.jpg",
      followerCount: 42,
      albumCount: 7,
      genres: ["soul"],
      profileUrl: "https://open.spotify.com/artist/sp1",
      topTrackName: "Song",
    });
  });

  it("has no image when Spotify has none", () => {
    expect(
      mapSpotifyArtist(
        {
          id: "a",
          name: "A",
          images: [],
          followers: { total: 0 },
          genres: [],
          external_urls: { spotify: "u" },
        },
        0,
        null,
      ).imageUrl,
    ).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { mapDeezerArtist } from "@/lib/musicPlatform/mapDeezerArtist";

describe("mapDeezerArtist", () => {
  it("normalizes a Deezer artist, using the XL picture", () => {
    expect(
      mapDeezerArtist(
        {
          id: 5,
          name: "Willie Colón",
          link: "https://www.deezer.com/artist/5",
          picture_medium: "m",
          picture_xl: "xl",
          nb_fan: 10,
          nb_album: 3,
        },
        "Top",
      ),
    ).toEqual({
      platform: "deezer",
      platformId: "5",
      name: "Willie Colón",
      imageUrl: "xl",
      followerCount: 10,
      albumCount: 3,
      genres: [],
      profileUrl: "https://www.deezer.com/artist/5",
      topTrackName: "Top",
    });
  });

  it("has no image when there is no XL picture", () => {
    expect(
      mapDeezerArtist(
        {
          id: 5,
          name: "A",
          link: "l",
          picture_medium: "m",
          picture_xl: "",
          nb_fan: 0,
          nb_album: 0,
        },
        null,
      ).imageUrl,
    ).toBeNull();
  });
});

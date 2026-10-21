import { beforeEach, describe, expect, it, vi } from "vitest";

const { spotify, deezer } = vi.hoisted(() => ({ spotify: vi.fn(), deezer: vi.fn() }));
vi.mock("@/lib/musicPlatform/getSpotifyArtistImage", () => ({ getSpotifyArtistImage: spotify }));
vi.mock("@/lib/musicPlatform/getDeezerArtistImage", () => ({ getDeezerArtistImage: deezer }));
const { getArtistImage } = await import("@/lib/musicPlatform/getArtistImage");

const headers = { headers: { Authorization: "Bearer t" } };

beforeEach(() => {
  spotify.mockReset();
  deezer.mockReset();
});

describe("getArtistImage", () => {
  it("prefers the artist's own upload and asks no provider", async () => {
    expect(
      await getArtistImage({ customImage: " /me.png ", spotify: "sp", deezer: "5" }, headers),
    ).toBe("/me.png");
    expect(spotify).not.toHaveBeenCalled();
    expect(deezer).not.toHaveBeenCalled();
  });

  it("asks Spotify before Deezer, whichever id came first", async () => {
    spotify.mockResolvedValueOnce(" https://i.scdn.co/a ");
    expect(await getArtistImage({ customImage: "", spotify: " sp ", deezer: "5" }, headers)).toBe(
      "https://i.scdn.co/a",
    );
    expect(spotify).toHaveBeenCalledWith("sp", headers);
    expect(deezer).not.toHaveBeenCalled();
  });

  it("falls back to Deezer when Spotify has nothing or fails", async () => {
    spotify.mockResolvedValueOnce(null);
    deezer.mockResolvedValueOnce("m");
    expect(await getArtistImage({ customImage: null, spotify: "sp", deezer: "5" }, null)).toBe("m");
    spotify.mockRejectedValueOnce(new Error("down"));
    deezer.mockResolvedValueOnce("m");
    expect(await getArtistImage({ customImage: null, spotify: "sp", deezer: "5" }, null)).toBe("m");
  });

  it("is null with no ids or when both providers fail", async () => {
    expect(
      await getArtistImage({ customImage: null, spotify: null, deezer: null }, null),
    ).toBeNull();
    spotify.mockResolvedValueOnce(null);
    deezer.mockRejectedValueOnce(new Error("down"));
    expect(
      await getArtistImage({ customImage: null, spotify: "sp", deezer: "5" }, null),
    ).toBeNull();
  });
});

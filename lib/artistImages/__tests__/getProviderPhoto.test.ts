import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDeezerArtist, getSpotifyArtistImage } = vi.hoisted(() => ({
  getDeezerArtist: vi.fn(),
  getSpotifyArtistImage: vi.fn(),
}));
vi.mock("@/lib/musicPlatform/getDeezerArtist", () => ({ getDeezerArtist }));
vi.mock("@/lib/musicPlatform/getSpotifyArtistImage", () => ({ getSpotifyArtistImage }));
const { getProviderPhoto } = await import("@/lib/artistImages/getProviderPhoto");

beforeEach(() => {
  getDeezerArtist.mockReset();
  getSpotifyArtistImage.mockReset();
});

describe("getProviderPhoto", () => {
  it("is null without a linked id, and never calls the provider", async () => {
    expect(await getProviderPhoto({ deezer: null, spotify: "  " }, "deezer")).toBeNull();
    expect(await getProviderPhoto({ deezer: null, spotify: "  " }, "spotify")).toBeNull();
    expect(getDeezerArtist).not.toHaveBeenCalled();
    expect(getSpotifyArtistImage).not.toHaveBeenCalled();
  });

  it("resolves Deezer's XL image for the trimmed id", async () => {
    getDeezerArtist.mockResolvedValueOnce({ imageUrl: "https://cdn.deezer/xl.jpg" });
    expect(await getProviderPhoto({ deezer: " 5590 ", spotify: null }, "deezer")).toBe(
      "https://cdn.deezer/xl.jpg",
    );
    expect(getDeezerArtist).toHaveBeenCalledWith("5590");
  });

  it("resolves Spotify's image", async () => {
    getSpotifyArtistImage.mockResolvedValueOnce("https://i.scdn.co/image/abc");
    expect(await getProviderPhoto({ deezer: null, spotify: "abc" }, "spotify")).toBe(
      "https://i.scdn.co/image/abc",
    );
    expect(getSpotifyArtistImage).toHaveBeenCalledWith("abc");
  });

  it("refuses anything but a credential-free https URL", async () => {
    getDeezerArtist.mockResolvedValueOnce({ imageUrl: "http://cdn.deezer/xl.jpg" });
    expect(await getProviderPhoto({ deezer: "1", spotify: null }, "deezer")).toBeNull();
    getDeezerArtist.mockResolvedValueOnce({ imageUrl: "https://user:pw@cdn.deezer/xl.jpg" });
    expect(await getProviderPhoto({ deezer: "1", spotify: null }, "deezer")).toBeNull();
    getDeezerArtist.mockResolvedValueOnce({ imageUrl: "not a url" });
    expect(await getProviderPhoto({ deezer: "1", spotify: null }, "deezer")).toBeNull();
  });

  it("is null when the provider has no artist, no image, or throws", async () => {
    getDeezerArtist.mockResolvedValueOnce(null);
    expect(await getProviderPhoto({ deezer: "1", spotify: null }, "deezer")).toBeNull();
    getDeezerArtist.mockResolvedValueOnce({ imageUrl: null });
    expect(await getProviderPhoto({ deezer: "1", spotify: null }, "deezer")).toBeNull();
    getSpotifyArtistImage.mockRejectedValueOnce(new Error("boom"));
    expect(await getProviderPhoto({ deezer: null, spotify: "x" }, "spotify")).toBeNull();
  });
});

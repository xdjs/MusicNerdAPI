import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ headers: vi.fn(), read: vi.fn(), deezer: vi.fn() }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders: m.headers }));
vi.mock("@/lib/spotify/readSpotifyJson", () => ({ readSpotifyJson: m.read }));
vi.mock("@/lib/musicPlatform/fetchDeezerArtist", () => ({ fetchDeezerArtist: m.deezer }));
const { getArtistIdentity } = await import("@/lib/catalogIdentity/getArtistIdentity");

beforeEach(() => {
  vi.clearAllMocks();
  m.headers.mockResolvedValue({ headers: {} });
});

describe("getArtistIdentity", () => {
  it("reads a Spotify artist's canonical id and name", async () => {
    m.read.mockResolvedValue({ id: "abc", name: "Radiohead" });
    expect(await getArtistIdentity("spotify", "abc")).toEqual({
      platform: "spotify",
      platformId: "abc",
      name: "Radiohead",
    });
    expect(m.read).toHaveBeenCalledWith("https://api.spotify.com/v1/artists/abc", { headers: {} });
  });

  it("reads a Deezer artist", async () => {
    m.deezer.mockResolvedValue({ id: 399, name: "Radiohead" });
    expect(await getArtistIdentity("deezer", "399")).toEqual({
      platform: "deezer",
      platformId: "399",
      name: "Radiohead",
    });
  });

  it("returns null for a failed read or a nameless artist", async () => {
    m.read.mockRejectedValueOnce(new Error("Spotify returned 404"));
    expect(await getArtistIdentity("spotify", "abc")).toBeNull();
    m.read.mockResolvedValueOnce({ id: "abc" });
    expect(await getArtistIdentity("spotify", "abc")).toBeNull();
    m.deezer.mockResolvedValueOnce(null);
    expect(await getArtistIdentity("deezer", "1")).toBeNull();
  });
});

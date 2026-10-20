import { describe, it, expect, vi } from "vitest";
import { fetchSpotifyArtist } from "@/lib/spotify/fetchSpotifyArtist";

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/spotify/fetchSpotifyResponse", () => ({
  fetchSpotifyResponse: mockFetch,
}));

const headers = { headers: { Authorization: "Bearer token" } };

describe("fetchSpotifyArtist", () => {
  it("returns artist data on success", async () => {
    const artist = {
      name: "Pete Rango",
      id: "123",
      images: [{ url: "https://img.com/1.jpg", height: 300, width: 300 }],
      followers: { total: 1000 },
      genres: ["hip-hop"],
      type: "artist",
      uri: "spotify:artist:123",
      external_urls: { spotify: "https://open.spotify.com/artist/123" },
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(artist) });

    const result = await fetchSpotifyArtist("123", headers);
    expect(result.error).toBeNull();
    expect(result.data?.name).toBe("Pete Rango");
    expect(result.data?.id).toBe("123");
  });

  it("returns error for 404", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await fetchSpotifyArtist("bad-id", headers);
    expect(result.error).toBe("Invalid Spotify ID");
    expect(result.data).toBeNull();
  });

  it("returns error for 401", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await fetchSpotifyArtist("123", headers);
    expect(result.error).toBe("Spotify authentication failed");
    expect(result.data).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { fetchSpotifyArtists } from "@/lib/spotify/fetchSpotifyArtists";

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/spotify/fetchSpotifyResponse", () => ({
  fetchSpotifyResponse: mockFetch,
}));

const headers = { headers: { Authorization: "Bearer token" } };

describe("fetchSpotifyArtists", () => {
  it("fetches multiple artists in one call", async () => {
    const artists = [
      { name: "Artist A", id: "a" },
      { name: "Artist B", id: "b" },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ artists }) });

    const result = await fetchSpotifyArtists(["a", "b"], headers);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Artist A");
  });

  it("returns empty array on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await fetchSpotifyArtists(["a"], headers);
    expect(result).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/networking/fetchJson", () => ({ fetchJson }));
const { searchDeezerArtists } = await import("@/lib/musicPlatform/searchDeezerArtists");

beforeEach(() => {
  fetchJson.mockReset();
});

describe("searchDeezerArtists", () => {
  it("searches by name, encoding the query, and maps the results", async () => {
    fetchJson.mockResolvedValueOnce({
      data: [
        {
          id: 5,
          name: "Willie Colón",
          link: "l",
          picture_medium: "m",
          picture_xl: "xl",
          nb_fan: 9,
          nb_album: 1,
        },
      ],
    });
    const out = await searchDeezerArtists("Willie Colón", 5);
    expect(fetchJson).toHaveBeenCalledWith(
      "https://api.deezer.com/search/artist?q=Willie%20Col%C3%B3n&limit=5",
      { timeoutMs: 5000 },
    );
    expect(out).toEqual([
      expect.objectContaining({ platformId: "5", followerCount: 9, topTrackName: null }),
    ]);
  });

  it("is empty for an empty query, an error body or a failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await searchDeezerArtists("  ", 5)).toEqual([]);
    expect(fetchJson).not.toHaveBeenCalled();
    fetchJson.mockResolvedValueOnce({ error: { type: "x", message: "y" } });
    expect(await searchDeezerArtists("a", 5)).toEqual([]);
    fetchJson.mockResolvedValueOnce(null);
    expect(await searchDeezerArtists("a", 5)).toEqual([]);
    error.mockRestore();
  });
});

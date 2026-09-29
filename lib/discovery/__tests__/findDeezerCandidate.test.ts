import { describe, it, expect, vi, beforeEach } from "vitest";

const { searchDeezerArtists } = vi.hoisted(() => ({ searchDeezerArtists: vi.fn() }));
vi.mock("@/lib/musicPlatform/searchDeezerArtists", () => ({ searchDeezerArtists }));
const { findDeezerCandidate } = await import("@/lib/discovery/findDeezerCandidate");

beforeEach(() => {
  searchDeezerArtists.mockReset();
});

describe("findDeezerCandidate", () => {
  it("proposes an exact-name match with its fan count", async () => {
    searchDeezerArtists.mockResolvedValueOnce([
      {
        platform: "deezer",
        platformId: "5",
        name: "Pete Rango",
        followerCount: 6,
        profileUrl: "https://www.deezer.com/artist/5",
      },
    ]);
    expect(await findDeezerCandidate("Pete Rango")).toEqual({
      tier: 2,
      platform: "deezer",
      url: "https://www.deezer.com/artist/5",
      reasoning: "Exact name match via Deezer search (6 fans)",
    });
    expect(searchDeezerArtists).toHaveBeenCalledWith("Pete Rango", 5);
  });

  it("proposes nothing without a match, and never throws", async () => {
    searchDeezerArtists.mockResolvedValueOnce([]);
    expect(await findDeezerCandidate("Pete Rango")).toBeNull();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    searchDeezerArtists.mockRejectedValueOnce(new Error("x"));
    expect(await findDeezerCandidate("Pete Rango")).toBeNull();
    error.mockRestore();
  });
});

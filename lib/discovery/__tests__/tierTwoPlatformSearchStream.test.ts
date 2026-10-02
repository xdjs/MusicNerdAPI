import { describe, it, expect, vi, beforeEach } from "vitest";

const { findSpotifyCandidate, findDeezerCandidate } = vi.hoisted(() => ({
  findSpotifyCandidate: vi.fn(),
  findDeezerCandidate: vi.fn(),
}));
vi.mock("@/lib/discovery/findSpotifyCandidate", () => ({ findSpotifyCandidate }));
vi.mock("@/lib/discovery/findDeezerCandidate", () => ({ findDeezerCandidate }));
const { tierTwoPlatformSearchStream } = await import("@/lib/discovery/tierTwoPlatformSearchStream");

const collect = async <T>(gen: AsyncGenerator<T>) => {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
};

beforeEach(() => {
  findSpotifyCandidate.mockReset();
  findDeezerCandidate.mockReset();
});

describe("tierTwoPlatformSearchStream", () => {
  it("searches only the missing platforms and yields each, hit or miss", async () => {
    const hit = { tier: 2, platform: "spotify", url: "u", reasoning: "r" };
    findSpotifyCandidate.mockResolvedValueOnce(hit);
    findDeezerCandidate.mockResolvedValueOnce(null);
    const out = await collect(
      tierTwoPlatformSearchStream("Pete Rango", new Set(["spotify", "deezer", "x"]), {
        deezer: "1",
      }),
    );
    expect(out).toEqual(
      expect.arrayContaining([
        ["spotify", hit],
        ["deezer", null],
      ]),
    );
    expect(findSpotifyCandidate).toHaveBeenCalledWith("Pete Rango", { deezer: "1" });
    expect(await collect(tierTwoPlatformSearchStream("P", new Set(["x"]), {}))).toEqual([]);
  });
});

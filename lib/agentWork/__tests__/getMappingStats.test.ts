import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getMappingStats } = await import("@/lib/agentWork/getMappingStats");

describe("getMappingStats", () => {
  it("lists every valid platform with its share of Spotify artists", async () => {
    execute
      .mockResolvedValueOnce([{ total: 200 }])
      .mockResolvedValueOnce([{ total: 90 }])
      .mockResolvedValueOnce([
        { platform: "deezer", mapped_count: 50 },
        { platform: "not_a_platform", mapped_count: 9 },
      ]);
    const stats = await getMappingStats();
    expect(stats.totalArtistsWithSpotify).toBe(200);
    expect(stats.totalArtistsWithDeezer).toBe(90);
    expect(stats.platformStats).toHaveLength(11);
    expect(stats.platformStats[0]).toEqual({ platform: "deezer", mappedCount: 50, percentage: 25 });
    expect(stats.platformStats.find(p => p.platform === "tidal")?.mappedCount).toBe(0);
    expect(stats.platformStats.some(p => p.platform === "not_a_platform")).toBe(false);
  });

  it("is 0% with no Spotify artists", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect((await getMappingStats()).platformStats[0].percentage).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async (_q: unknown): Promise<unknown[]> => []),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getMappingStats } = await import("@/lib/mcp/getMappingStats");

beforeEach(() => vi.clearAllMocks());

describe("getMappingStats", () => {
  it("reports both totals and a rounded percentage per valid platform, zero when unmapped", async () => {
    execute
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { platform: "deezer", mapped_count: 2 },
        { platform: "apple_music", mapped_count: 1 },
        { platform: "spotify", mapped_count: 9 },
      ]);
    const stats = await getMappingStats();
    expect(stats.totalArtistsWithSpotify).toBe(3);
    expect(stats.totalArtistsWithDeezer).toBe(2);
    expect(stats.platformStats).toHaveLength(VALID_MAPPING_PLATFORMS.size);
    expect(stats.platformStats.map(s => s.platform)).toEqual([...VALID_MAPPING_PLATFORMS]);
    expect(stats.platformStats[0]).toEqual({
      platform: "deezer",
      mappedCount: 2,
      percentage: 66.67,
    });
    expect(stats.platformStats[1]).toEqual({
      platform: "apple_music",
      mappedCount: 1,
      percentage: 33.33,
    });
    expect(stats.platformStats.find(s => s.platform === "tidal")).toEqual({
      platform: "tidal",
      mappedCount: 0,
      percentage: 0,
    });
    expect(renderSql(execute.mock.calls[0][0] as never).text).toBe(
      "SELECT COUNT(*)::int AS total FROM artists WHERE spotify IS NOT NULL",
    );
    expect(renderSql(execute.mock.calls[1][0] as never).text).toBe(
      "SELECT COUNT(*)::int AS total FROM artists WHERE deezer IS NOT NULL",
    );
    expect(renderSql(execute.mock.calls[2][0] as never).text).toBe(
      "SELECT platform, COUNT(*)::int AS mapped_count FROM artist_id_mappings GROUP BY platform ORDER BY mapped_count DESC",
    );
  });

  it("is all zeros when nothing has a spotify id", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ platform: "deezer", mapped_count: 5 }]);
    const stats = await getMappingStats();
    expect(stats.totalArtistsWithSpotify).toBe(0);
    expect(stats.platformStats[0]).toEqual({ platform: "deezer", mappedCount: 5, percentage: 0 });
  });
});

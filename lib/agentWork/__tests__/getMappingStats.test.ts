import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { VALID_MAPPING_PLATFORMS } from "@/lib/agentWork/const";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getMappingStats } from "@/lib/agentWork/getMappingStats";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getMappingStats", () => {
  it("lists every valid platform with its count and share of Spotify artists", async () => {
    mock.execute
      .mockResolvedValueOnce([{ total: 400 }])
      .mockResolvedValueOnce([{ total: 50 }])
      .mockResolvedValueOnce([{ platform: "deezer", mapped_count: 100 }]);
    const stats = await getMappingStats();
    expect(stats.totalArtistsWithSpotify).toBe(400);
    expect(stats.totalArtistsWithDeezer).toBe(50);
    expect(stats.platformStats).toHaveLength(VALID_MAPPING_PLATFORMS.size);
    expect(stats.platformStats[0]).toEqual({
      platform: "deezer",
      mappedCount: 100,
      percentage: 25,
    });
    expect(stats.platformStats.find(p => p.platform === "genius")).toEqual({
      platform: "genius",
      mappedCount: 0,
      percentage: 0,
    });
    const texts = mock.execute.mock.calls.map(c => renderSql(c[0] as SQL).text);
    expect(texts[0]).toBe("SELECT COUNT(*)::int AS total FROM artists WHERE spotify IS NOT NULL");
    expect(texts[1]).toBe("SELECT COUNT(*)::int AS total FROM artists WHERE deezer IS NOT NULL");
    expect(texts[2]).toContain(
      "FROM artist_id_mappings GROUP BY platform ORDER BY mapped_count DESC",
    );
  });

  it("uses 0 percentages when no artist has a Spotify ID", async () => {
    mock.execute.mockResolvedValue([]);
    const stats = await getMappingStats();
    expect(stats.totalArtistsWithSpotify).toBe(0);
    expect(stats.platformStats.every(p => p.percentage === 0 && p.mappedCount === 0)).toBe(true);
  });
});

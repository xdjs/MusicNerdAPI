import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import { getArtistDataSummary } from "@/lib/artistData/getArtistDataSummary";

const mock = vi.hoisted(() => ({
  totals: vi.fn(),
  platforms: vi.fn(),
  today: vi.fn(),
  completeness: vi.fn(),
}));
vi.mock("@/lib/artistData/getArtistTotalsAndCoverage", () => ({
  getArtistTotalsAndCoverage: mock.totals,
}));
vi.mock("@/lib/artistData/getPlatformIdStats", () => ({ getPlatformIdStats: mock.platforms }));
vi.mock("@/lib/artistData/getLinkTodayCounts", () => ({ getLinkTodayCounts: mock.today }));
vi.mock("@/lib/artistData/getCompletenessDistribution", () => ({
  getCompletenessDistribution: mock.completeness,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mock.totals.mockResolvedValue({
    totalArtists: 200,
    totalWithSpotify: 160,
    columnCounts: { instagram: 100, bio: 20 },
    enrichment: { hasWikidata: 5, hasSpotifyNoWikidata: 155, noSpotify: 40 },
  });
  mock.platforms.mockResolvedValue(new Map([["deezer", { count: 40, todayCount: 2 }]]));
  mock.today.mockResolvedValue(new Map([["instagram", 3]]));
  mock.completeness.mockResolvedValue({
    buckets: [{ bucket: "0-1", count: 200, percentage: 100 }],
    medianFields: 1,
    averageFields: 1.5,
  });
});

describe("getArtistDataSummary", () => {
  it("assembles MusicNerdWeb's summary with percentages to two decimals", async () => {
    const summary = await getArtistDataSummary();
    expect(summary.totalArtists).toBe(200);
    expect(summary.totalWithSpotify).toBe(160);
    expect(summary.platformIdCoverage).toEqual([
      { platform: "deezer", count: 40, percentage: 25, todayCount: 2 },
    ]);
    expect(summary.artistLinkCoverage).toHaveLength(TRACKED_COLUMNS.length);
    expect(summary.artistLinkCoverage[0]).toEqual({
      column: "instagram",
      category: "social",
      count: 100,
      percentage: 50,
      todayCount: 3,
    });
    expect(summary.artistLinkCoverage.find(c => c.column === "bio")).toEqual({
      column: "bio",
      category: "content",
      count: 20,
      percentage: 10,
      todayCount: 0,
    });
    expect(summary.artistLinkCoverage.find(c => c.column === "patreon")?.count).toBe(0);
    expect(summary.completenessDistribution).toEqual([
      { bucket: "0-1", count: 200, percentage: 100 },
    ]);
    expect(summary.medianFields).toBe(1);
    expect(summary.averageFields).toBe(1.5);
    expect(summary.enrichmentReadiness).toEqual({
      hasWikidata: 5,
      hasSpotifyNoWikidata: 155,
      noSpotify: 40,
    });
  });

  it("uses 0 percentages when there are no artists", async () => {
    mock.totals.mockResolvedValueOnce({
      totalArtists: 0,
      totalWithSpotify: 0,
      columnCounts: {},
      enrichment: { hasWikidata: 0, hasSpotifyNoWikidata: 0, noSpotify: 0 },
    });
    const summary = await getArtistDataSummary();
    expect(summary.platformIdCoverage[0].percentage).toBe(0);
    expect(summary.artistLinkCoverage[0].percentage).toBe(0);
  });
});

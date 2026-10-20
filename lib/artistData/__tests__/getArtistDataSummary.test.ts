import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/artistData/getArtistTotalsAndCoverage", () => ({
  getArtistTotalsAndCoverage: async () => ({
    totalArtists: 200,
    totalWithSpotify: 100,
    columnCounts: { instagram: 50 },
    enrichment: { hasWikidata: 1, hasSpotifyNoWikidata: 2, noSpotify: 3 },
  }),
}));
vi.mock("@/lib/artistData/getPlatformIdStats", () => ({
  getPlatformIdStats: async () => new Map([["deezer", { count: 25, todayCount: 4 }]]),
}));
vi.mock("@/lib/artistData/getLinkTodayCounts", () => ({
  getLinkTodayCounts: async () => new Map([["instagram", 7]]),
}));
vi.mock("@/lib/artistData/getCompletenessDistribution", () => ({
  getCompletenessDistribution: async () => ({ buckets: [], medianFields: 1, averageFields: 2 }),
}));
const { getArtistDataSummary } = await import("@/lib/artistData/getArtistDataSummary");

describe("getArtistDataSummary", () => {
  it("combines the sections with percentages", async () => {
    const s = await getArtistDataSummary();
    expect(s.platformIdCoverage).toEqual([
      { platform: "deezer", count: 25, percentage: 25, todayCount: 4 },
    ]);
    expect(s.artistLinkCoverage[0]).toEqual({
      column: "instagram",
      category: "social",
      count: 50,
      percentage: 25,
      todayCount: 7,
    });
    expect(s.artistLinkCoverage).toHaveLength(21);
    expect(s).toMatchObject({
      totalArtists: 200,
      totalWithSpotify: 100,
      medianFields: 1,
      averageFields: 2,
      enrichmentReadiness: { hasWikidata: 1, hasSpotifyNoWikidata: 2, noSpotify: 3 },
    });
  });
});

import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import { getArtistTotalsAndCoverage } from "@/lib/artistData/getArtistTotalsAndCoverage";
import { getCompletenessDistribution } from "@/lib/artistData/getCompletenessDistribution";
import { getLinkTodayCounts } from "@/lib/artistData/getLinkTodayCounts";
import { getPlatformIdStats } from "@/lib/artistData/getPlatformIdStats";
import type { ArtistDataSummary } from "@/lib/artistData/types";

const percent = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 10000) / 100 : 0;

/**
 * The Artist Data tab: platform ID coverage of Spotify artists, link coverage
 * of all artists, completeness and enrichment readiness.
 *
 * @returns The summary.
 */
export async function getArtistDataSummary(): Promise<ArtistDataSummary> {
  const [totals, platformStats, linkToday, completeness] = await Promise.all([
    getArtistTotalsAndCoverage(),
    getPlatformIdStats(),
    getLinkTodayCounts(),
    getCompletenessDistribution(),
  ]);
  return {
    totalArtists: totals.totalArtists,
    totalWithSpotify: totals.totalWithSpotify,
    platformIdCoverage: [...platformStats.entries()].map(([platform, s]) => ({
      platform,
      count: s.count,
      percentage: percent(s.count, totals.totalWithSpotify),
      todayCount: s.todayCount,
    })),
    artistLinkCoverage: TRACKED_COLUMNS.map(({ column, category }) => {
      const count = totals.columnCounts[column] ?? 0;
      return {
        column,
        category,
        count,
        percentage: percent(count, totals.totalArtists),
        todayCount: linkToday.get(column) ?? 0,
      };
    }),
    completenessDistribution: completeness.buckets,
    medianFields: completeness.medianFields,
    averageFields: completeness.averageFields,
    enrichmentReadiness: totals.enrichment,
  };
}

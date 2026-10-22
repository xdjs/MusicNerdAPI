import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import { getArtistTotalsAndCoverage } from "@/lib/artistData/getArtistTotalsAndCoverage";
import { getCompletenessDistribution } from "@/lib/artistData/getCompletenessDistribution";
import { getLinkTodayCounts } from "@/lib/artistData/getLinkTodayCounts";
import { getPlatformIdStats } from "@/lib/artistData/getPlatformIdStats";
import type {
  ArtistDataSummary,
  ArtistLinkCoverageItem,
  PlatformIdCoverageItem,
} from "@/lib/artistData/types";

/**
 * The Artist data tab: link coverage, platform ID coverage, completeness
 * distribution and enrichment readiness, from four concurrent queries.
 *
 * @returns The summary MusicNerdWeb's admin renders.
 */
export async function getArtistDataSummary(): Promise<ArtistDataSummary> {
  const [totalsAndCoverage, platformStats, linkTodayCounts, completeness] = await Promise.all([
    getArtistTotalsAndCoverage(),
    getPlatformIdStats(),
    getLinkTodayCounts(),
    getCompletenessDistribution(),
  ]);

  const { totalArtists, totalWithSpotify, columnCounts, enrichment } = totalsAndCoverage;

  // Section 1: Platform ID coverage (mapped IDs from artist_id_mappings)
  const platformIdCoverage: PlatformIdCoverageItem[] = [...platformStats.entries()].map(
    ([platform, stats]) => ({
      platform,
      count: stats.count,
      percentage:
        totalWithSpotify > 0 ? Math.round((stats.count / totalWithSpotify) * 10000) / 100 : 0,
      todayCount: stats.todayCount,
    }),
  );

  // Section 2: Artist link coverage
  const artistLinkCoverage: ArtistLinkCoverageItem[] = TRACKED_COLUMNS.map(
    ({ column, category }) => {
      const count = columnCounts[column] ?? 0;
      return {
        column,
        category,
        count,
        percentage: totalArtists > 0 ? Math.round((count / totalArtists) * 10000) / 100 : 0,
        todayCount: linkTodayCounts.get(column) ?? 0,
      };
    },
  );

  return {
    totalArtists,
    totalWithSpotify,
    platformIdCoverage,
    artistLinkCoverage,
    completenessDistribution: completeness.buckets,
    medianFields: completeness.medianFields,
    averageFields: completeness.averageFields,
    enrichmentReadiness: enrichment,
  };
}

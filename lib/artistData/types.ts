import type { TRACKED_COLUMNS } from "@/lib/artistData/const";

export type TrackedColumnCategory = (typeof TRACKED_COLUMNS)[number]["category"];

export interface PlatformIdCoverageItem {
  platform: string;
  count: number;
  percentage: number;
  todayCount: number;
}

export interface ArtistLinkCoverageItem {
  column: string;
  category: TrackedColumnCategory;
  count: number;
  percentage: number;
  todayCount: number;
}

export interface CompletenessBucket {
  bucket: string;
  count: number;
  percentage: number;
}

export interface EnrichmentReadiness {
  hasWikidata: number;
  hasSpotifyNoWikidata: number;
  noSpotify: number;
}

/** The Artist data tab's payload, as MusicNerdWeb's `getArtistDataSummary` returns it. */
export interface ArtistDataSummary {
  totalArtists: number;
  totalWithSpotify: number;
  platformIdCoverage: PlatformIdCoverageItem[];
  artistLinkCoverage: ArtistLinkCoverageItem[];
  completenessDistribution: CompletenessBucket[];
  medianFields: number;
  averageFields: number;
  enrichmentReadiness: EnrichmentReadiness;
}

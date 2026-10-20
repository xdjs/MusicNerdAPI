import { sql } from "drizzle-orm";
import { VALID_MAPPING_PLATFORMS } from "@/lib/agentWork/const";
import type { MappingStats } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * How many Spotify artists each mapping platform covers. Every valid platform
 * is listed, at zero when nothing is mapped yet.
 *
 * @returns Spotify and Deezer totals and per-platform counts with a percentage of Spotify artists.
 */
export async function getMappingStats(): Promise<MappingStats> {
  const [spotifyRows, deezerRows, statRows] = await Promise.all([
    db.execute<{ total: number }>(
      sql`select count(*)::int as total from artists where spotify is not null`,
    ),
    db.execute<{ total: number }>(
      sql`select count(*)::int as total from artists where deezer is not null`,
    ),
    db.execute<{ platform: string; mapped_count: number }>(sql`select platform,
      count(*)::int as mapped_count from artist_id_mappings group by platform order by mapped_count desc`),
  ]);
  const totalArtistsWithSpotify = spotifyRows[0]?.total ?? 0;
  const counts = new Map([...statRows].map(r => [r.platform, r.mapped_count]));
  return {
    totalArtistsWithSpotify,
    totalArtistsWithDeezer: deezerRows[0]?.total ?? 0,
    platformStats: [...VALID_MAPPING_PLATFORMS].map(platform => {
      const mappedCount = counts.get(platform) ?? 0;
      return {
        platform,
        mappedCount,
        percentage:
          totalArtistsWithSpotify > 0
            ? Math.round((mappedCount / totalArtistsWithSpotify) * 10000) / 100
            : 0,
      };
    }),
  };
}

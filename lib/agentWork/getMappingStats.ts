import { sql } from "drizzle-orm";
import { VALID_MAPPING_PLATFORMS } from "@/lib/agentWork/const";
import type { MappingStats } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * How many artists have a Spotify or Deezer ID, and how many are mapped on
 * each platform. Every valid platform is listed, mapped or not. Copied from
 * MusicNerdWeb's `idMappingService`.
 *
 * @returns The totals and per-platform stats.
 */
export async function getMappingStats(): Promise<MappingStats> {
  const [totalResult, totalDeezerResult, statsResult] = await Promise.all([
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total FROM artists WHERE spotify IS NOT NULL
    `),
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total FROM artists WHERE deezer IS NOT NULL
    `),
    db.execute<{ platform: string; mapped_count: number }>(sql`
      SELECT platform, COUNT(*)::int AS mapped_count
      FROM artist_id_mappings
      GROUP BY platform
      ORDER BY mapped_count DESC
    `),
  ]);

  const totalArtistsWithSpotify = totalResult[0]?.total ?? 0;
  const totalArtistsWithDeezer = totalDeezerResult[0]?.total ?? 0;

  // Build a map of DB results, then ensure all valid platforms are represented
  const dbStats = new Map([...statsResult].map(row => [row.platform, row.mapped_count]));
  const platformStats = [...VALID_MAPPING_PLATFORMS].map(platform => {
    const mappedCount = dbStats.get(platform) ?? 0;
    return {
      platform,
      mappedCount,
      percentage:
        totalArtistsWithSpotify > 0
          ? Math.round((mappedCount / totalArtistsWithSpotify) * 10000) / 100
          : 0,
    };
  });

  return { totalArtistsWithSpotify, totalArtistsWithDeezer, platformStats };
}

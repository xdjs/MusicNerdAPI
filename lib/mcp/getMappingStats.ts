import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";

/**
 * Mapping coverage: how many artists hold a Spotify or Deezer id, and per
 * valid platform how many are mapped and what share of the Spotify total that is.
 *
 * @returns The totals and one entry per valid platform, zero when unmapped.
 */
export async function getMappingStats(): Promise<{
  totalArtistsWithSpotify: number;
  totalArtistsWithDeezer: number;
  platformStats: { platform: string; mappedCount: number; percentage: number }[];
}> {
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

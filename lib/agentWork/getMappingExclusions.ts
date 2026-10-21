import { sql } from "drizzle-orm";
import { VALID_MAPPING_PLATFORMS } from "@/lib/agentWork/const";
import type { MappingExclusions } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * The exclusions recorded for one platform, newest first, with the artist's
 * name and Spotify ID. Copied from MusicNerdWeb's `idMappingService`.
 *
 * @param platform - A mapping platform.
 * @param limit - At most this many, clamped to 1–500.
 * @returns The exclusions and the platform's total. Throws on an unknown platform.
 */
export async function getMappingExclusions(
  platform: string,
  limit: number = 100,
): Promise<MappingExclusions> {
  if (!VALID_MAPPING_PLATFORMS.has(platform)) {
    throw new Error(`Invalid platform: ${platform}`);
  }

  const effectiveLimit = Math.min(Math.max(limit, 1), 500);

  const [countResult, result] = await Promise.all([
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total
      FROM artist_mapping_exclusions
      WHERE platform = ${platform}
    `),
    db.execute<{
      id: string;
      artist_id: string;
      artist_name: string | null;
      spotify: string | null;
      platform: string;
      reason: string;
      details: string | null;
      created_at: string;
    }>(sql`
      SELECT e.id, e.artist_id, a.name AS artist_name, a.spotify, e.platform, e.reason, e.details, e.created_at
      FROM artist_mapping_exclusions e
      JOIN artists a ON a.id = e.artist_id
      WHERE e.platform = ${platform}
      ORDER BY e.created_at DESC
      LIMIT ${effectiveLimit}
    `),
  ]);

  return {
    exclusions: [...result].map(row => ({
      id: row.id,
      artistId: row.artist_id,
      artistName: row.artist_name,
      spotify: row.spotify,
      platform: row.platform,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
    })),
    total: countResult[0]?.total ?? 0,
  };
}

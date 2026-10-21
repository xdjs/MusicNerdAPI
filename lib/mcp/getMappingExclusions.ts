import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

type ExclusionRow = {
  id: string;
  artist_id: string;
  artist_name: string | null;
  spotify: string | null;
  platform: string;
  reason: string;
  details: string | null;
  created_at: string;
};

/**
 * The artists excluded from mapping for a platform, newest first, with the
 * platform's total. Exclusions are cleared with direct database access only.
 *
 * @param platform - The target platform.
 * @param limit - Page size, clamped to 1..500.
 * @returns The exclusions and the total.
 */
export async function getMappingExclusions(
  platform: string,
  limit: number = 100,
): Promise<{
  exclusions: {
    id: string;
    artistId: string;
    artistName: string | null;
    spotify: string | null;
    platform: string;
    reason: string;
    details: string | null;
    createdAt: string;
  }[];
  total: number;
}> {
  if (!VALID_MAPPING_PLATFORMS.has(platform)) {
    throw new MappingValidationError(`Invalid platform: ${platform}`);
  }

  const effectiveLimit = Math.min(Math.max(limit, 1), 500);

  const [countResult, result] = await Promise.all([
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total
      FROM artist_mapping_exclusions
      WHERE platform = ${platform}
    `),
    db.execute<ExclusionRow>(sql`
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

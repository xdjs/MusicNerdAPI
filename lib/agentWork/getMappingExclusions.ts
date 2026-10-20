import { sql } from "drizzle-orm";
import type { MappingExclusion } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Artists an agent excluded from mapping on one platform, newest first.
 *
 * @param platform - A valid mapping platform.
 * @param limit - Rows to return, clamped to 1–500.
 * @returns The exclusions and the platform's total.
 */
export async function getMappingExclusions(
  platform: string,
  limit = 100,
): Promise<{ exclusions: MappingExclusion[]; total: number }> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 500);
  const [countRows, rows] = await Promise.all([
    db.execute<{ total: number }>(sql`select count(*)::int as total
      from artist_mapping_exclusions where platform = ${platform}`),
    db.execute<{
      id: string;
      artist_id: string;
      artist_name: string | null;
      spotify: string | null;
      platform: string;
      reason: string;
      details: string | null;
      created_at: string;
    }>(sql`select e.id, e.artist_id, a.name as artist_name, a.spotify, e.platform, e.reason,
        e.details, e.created_at
      from artist_mapping_exclusions e join artists a on a.id = e.artist_id
      where e.platform = ${platform} order by e.created_at desc limit ${effectiveLimit}`),
  ]);
  return {
    exclusions: [...rows].map(r => ({
      id: r.id,
      artistId: r.artist_id,
      artistName: r.artist_name,
      spotify: r.spotify,
      platform: r.platform,
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
    })),
    total: countRows[0]?.total ?? 0,
  };
}

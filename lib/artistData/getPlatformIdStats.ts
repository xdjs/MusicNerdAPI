import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Platform ID mapping counts and today's counts from `artist_id_mappings`,
 * most mapped first.
 *
 * @returns Each platform's count and today's count.
 */
export async function getPlatformIdStats(): Promise<
  Map<string, { count: number; todayCount: number }>
> {
  const rows = await db.execute<{ platform: string; count: number; today_count: number }>(sql`
    SELECT platform,
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today_count
    FROM artist_id_mappings
    GROUP BY platform
    ORDER BY count DESC
  `);
  return new Map([...rows].map(r => [r.platform, { count: r.count, todayCount: r.today_count }]));
}

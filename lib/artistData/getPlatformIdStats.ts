import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * ID mappings per platform, all-time and today, in one query.
 *
 * @returns A map of platform to its counts, largest first.
 */
export async function getPlatformIdStats(): Promise<
  Map<string, { count: number; todayCount: number }>
> {
  const rows = await db.execute<{ platform: string; count: number; today_count: number }>(sql`
    select platform, count(*)::int as count,
      count(*) filter (where created_at >= current_date)::int as today_count
    from artist_id_mappings group by platform order by count desc`);
  return new Map([...rows].map(r => [r.platform, { count: r.count, todayCount: r.today_count }]));
}

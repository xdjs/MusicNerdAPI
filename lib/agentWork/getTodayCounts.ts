import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * How many ID mappings each platform gained since midnight, database time.
 *
 * @returns Counts by platform; platforms with none are absent.
 */
export async function getTodayCounts(): Promise<Record<string, number>> {
  const rows = await db.execute<{ platform: string; today: number }>(sql`
    SELECT platform, COUNT(*)::int AS today
    FROM artist_id_mappings
    WHERE created_at >= CURRENT_DATE
    GROUP BY platform
  `);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.platform] = r.today;
  return map;
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * ID mappings created today, per platform.
 *
 * @returns A map of platform to today's count; platforms with none are absent.
 */
export async function getTodayCounts(): Promise<Record<string, number>> {
  const rows = await db.execute<{ platform: string; today: number }>(sql`
    select platform, count(*)::int as today from artist_id_mappings
    where created_at >= current_date group by platform`);
  return Object.fromEntries([...rows].map(r => [r.platform, r.today]));
}

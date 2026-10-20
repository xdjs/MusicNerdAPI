import { sql } from "drizzle-orm";
import type { ActivityPulse } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * When an agent last wrote, and how many artists agents touched in the last hour.
 *
 * @returns The last write time and the hourly artist count.
 */
export async function getActivityPulse(): Promise<ActivityPulse> {
  const [row] = await db.execute<{ last_write_at: string | null; rate_last_hour: number }>(sql`
    select max(created_at) as last_write_at,
      count(distinct artist_id) filter (where created_at > now() - interval '1 hour')::int as rate_last_hour
    from mcp_audit_log`);
  return { lastWriteAt: row?.last_write_at ?? null, rateLastHour: row?.rate_last_hour ?? 0 };
}

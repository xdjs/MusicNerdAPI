import { sql } from "drizzle-orm";
import type { ActivityPulse } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * The newest MCP audit write and how many distinct artists were written in
 * the last hour.
 *
 * @returns The pulse.
 */
export async function getActivityPulse(): Promise<ActivityPulse> {
  const result = await db.execute<{ last_write_at: string | null; rate_last_hour: number }>(sql`
    SELECT MAX(created_at) AS last_write_at,
           COUNT(DISTINCT artist_id) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS rate_last_hour
    FROM mcp_audit_log
  `);
  return {
    lastWriteAt: result[0]?.last_write_at ?? null,
    rateLastHour: result[0]?.rate_last_hour ?? 0,
  };
}

import { sql } from "drizzle-orm";
import type { HourlyActivityBucket } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Resolve and exclude counts per hour over the last 24 hours, oldest first;
 * hours with no writes are absent.
 *
 * @returns The hourly buckets.
 */
export async function getHourlyActivity(): Promise<HourlyActivityBucket[]> {
  const rows = await db.execute<{ hour: string; resolve_count: number; exclude_count: number }>(sql`
    SELECT date_trunc('hour', created_at) AS hour,
           COUNT(*) FILTER (WHERE action = 'resolve')::int AS resolve_count,
           COUNT(*) FILTER (WHERE action = 'exclude')::int AS exclude_count
    FROM mcp_audit_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY 1 ORDER BY 1
  `);
  return [...rows].map(r => ({
    hour: r.hour,
    resolveCount: r.resolve_count,
    excludeCount: r.exclude_count,
  }));
}

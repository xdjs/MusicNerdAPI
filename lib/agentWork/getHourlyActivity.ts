import { sql } from "drizzle-orm";
import type { HourlyActivityBucket } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Agent resolves and excludes per hour over the last 24 hours.
 *
 * @returns One bucket per hour that had activity, oldest first.
 */
export async function getHourlyActivity(): Promise<HourlyActivityBucket[]> {
  const rows = await db.execute<{ hour: string; resolve_count: number; exclude_count: number }>(sql`
    select date_trunc('hour', created_at) as hour,
      count(*) filter (where action = 'resolve')::int as resolve_count,
      count(*) filter (where action = 'exclude')::int as exclude_count
    from mcp_audit_log where created_at > now() - interval '24 hours'
    group by 1 order by 1`);
  return [...rows].map(r => ({
    hour: r.hour,
    resolveCount: r.resolve_count,
    excludeCount: r.exclude_count,
  }));
}

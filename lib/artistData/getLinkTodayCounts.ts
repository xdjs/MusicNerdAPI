import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Artists whose link column an MCP agent set today, per column. Manual edits,
 * UGC approvals and direct writes aren't in the audit log, so aren't counted.
 *
 * @returns A map of column to today's artist count.
 */
export async function getLinkTodayCounts(): Promise<Map<string, number>> {
  const rows = await db.execute<{ field: string; today: number }>(sql`
    select field, count(distinct artist_id)::int as today from mcp_audit_log
    where action = 'set' and created_at >= current_date group by field`);
  return new Map([...rows].map(r => [r.field, r.today]));
}

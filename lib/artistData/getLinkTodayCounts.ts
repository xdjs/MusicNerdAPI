import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Today's link writes per column, from the MCP audit log. Only MCP-driven
 * `set` writes are captured; manual edits, UGC approvals and direct database
 * writes are not tracked.
 *
 * @returns Distinct artists written per field since midnight.
 */
export async function getLinkTodayCounts(): Promise<Map<string, number>> {
  const rows = await db.execute<{ field: string; today: number }>(sql`
    SELECT field, COUNT(DISTINCT artist_id)::int AS today
    FROM mcp_audit_log
    WHERE action = 'set'
      AND created_at >= CURRENT_DATE
    GROUP BY field
  `);
  return new Map([...rows].map(r => [r.field, r.today]));
}

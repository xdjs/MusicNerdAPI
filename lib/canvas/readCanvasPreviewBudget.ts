import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
/** Read the existing shared preview ledger without making a reservation or changing its window. */
export async function readCanvasPreviewBudget() {
  const [row] = await db.execute<{ micros: number }>(sql`
    select coalesce(sum(coalesce((
      select min(substring(s.trigger from '^demo_20261029_usd_micro:([0-9]+)$')::bigint)
      from artist_activity_events s where s.parent_activity_id=r.id
      and s.action='canvas_preview_settlement' and s.trigger ~ '^demo_20261029_usd_micro:[0-9]+$'
    ),1000000)),0)::bigint as micros from artist_activity_events r
    where r.action='canvas_preview_reservation' and r.trigger='demo_20261029_usd1'`);
  const used = Number(row?.micros);
  if (!Number.isSafeInteger(used) || used < 0) return null;
  const expiresAt = "2026-10-30T04:00:00Z";
  return {
    reservedOrSettledUsd: used / 1_000_000,
    remainingUsd: Math.max(0, 18 - used / 1_000_000),
    expiresAt,
    windowOpen: Date.now() < Date.parse(expiresAt),
  };
}

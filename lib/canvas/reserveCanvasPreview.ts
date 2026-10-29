import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
/** Shared preview-only budget: 18 single-dollar worst-case reservations, never refunded. */
export async function reserveCanvasPreview(artistId: string): Promise<void> {
  if (process.env.VERCEL_ENV !== "preview" || process.env.MUSICNERD_CANVAS_PREVIEW_ENABLED !== "1")
    throw new Error("Canvas preview disabled");
  if (Date.now() >= Date.parse("2026-10-29T16:00:00Z"))
    throw new Error("Demo budget window closed");
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('canvas-demo-20261029-budget'))`);
    const [row] = await tx.execute<{ count: number }>(
      sql`select count(*)::int as count from artist_activity_events where action='canvas_preview_reservation' and trigger='demo_20261029_usd1'`,
    );
    if (!row || !Number.isInteger(row.count) || row.count >= 18)
      throw new Error("Preview call budget exhausted");
    await tx.execute(
      sql`insert into artist_activity_events(artist_id,actor_kind,action,trigger) values(${artistId}::uuid,'system','canvas_preview_reservation','demo_20261029_usd1')`,
    );
  });
}

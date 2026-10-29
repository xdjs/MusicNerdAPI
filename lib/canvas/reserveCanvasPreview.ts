import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
/** Shared $18 ledger: reserve $1 before each call; only confirmed total usage can settle it lower. */
export async function reserveCanvasPreview(artistId: string): Promise<string> {
  if (process.env.VERCEL_ENV !== "preview" || process.env.MUSICNERD_CANVAS_PREVIEW_ENABLED !== "1")
    throw new Error("Canvas preview disabled");
  if (Date.now() >= Date.parse("2026-10-30T04:00:00Z"))
    throw new Error("Demo budget window closed");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('canvas-demo-20261029-budget'))`);
    const [row] = await tx.execute<{ micros: number }>(sql`
      select coalesce(sum(coalesce((
        select min(substring(s.trigger from '^demo_20261029_usd_micro:([0-9]+)$')::bigint)
        from artist_activity_events s where s.parent_activity_id=r.id
        and s.action='canvas_preview_settlement' and s.trigger ~ '^demo_20261029_usd_micro:[0-9]+$'
      ),1000000)),0)::bigint as micros from artist_activity_events r
      where r.action='canvas_preview_reservation' and r.trigger='demo_20261029_usd1'`);
    const micros = Number(row?.micros);
    if (!Number.isSafeInteger(micros) || micros < 0 || micros + 1_000_000 > 18_000_000)
      throw new Error("Preview call budget exhausted");
    // Preserve the original marker: older deployments count every new reservation and still stop at 18.
    const [reservation] = await tx.execute<{ id: string }>(
      sql`insert into artist_activity_events(artist_id,actor_kind,action,trigger) values(${artistId}::uuid,'system','canvas_preview_reservation','demo_20261029_usd1') returning id`,
    );
    if (!reservation) throw new Error("Preview reservation unavailable");
    return reservation.id;
  });
}

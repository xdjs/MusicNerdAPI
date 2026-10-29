import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
/** Idempotently settle a completed call at conservative rates; missing/uncertain usage keeps the full dollar. */
export async function settleCanvasPreview(
  reservationId: string,
  usage: { inputTokens?: number; outputTokens?: number },
): Promise<number | null> {
  if (process.env.VERCEL_ENV !== "preview" || process.env.MUSICNERD_CANVAS_PREVIEW_ENABLED !== "1")
    return null;
  const input = usage.inputTokens,
    output = usage.outputTokens;
  if (
    input === undefined ||
    output === undefined ||
    !Number.isSafeInteger(input) ||
    !Number.isSafeInteger(output) ||
    input < 0 ||
    input > 200000 ||
    output < 0 ||
    output > 8192
  )
    return null;
  // $3/M input and $12/M output exceed verified maximum model/cache/region rates ($2.75/$11).
  const micros = input * 3 + output * 12;
  if (micros > 1_000_000) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('canvas-demo-20261029-budget'))`);
    const rows = await tx.execute<{
      id: string;
    }>(sql`insert into artist_activity_events(artist_id,actor_kind,action,trigger,parent_activity_id)
      select artist_id,'system','canvas_preview_settlement',${`demo_20261029_usd_micro:${micros}`},id
      from artist_activity_events r where id=${reservationId}::uuid
      and action='canvas_preview_reservation' and trigger='demo_20261029_usd1'
      and not exists(select 1 from artist_activity_events s where s.parent_activity_id=r.id and s.action='canvas_preview_settlement') returning id`);
    return rows.length ? micros : null;
  });
}

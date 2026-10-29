import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
      }),
  },
}));
const { reserveCanvasPreview } = await import("../reserveCanvasPreview");
const { settleCanvasPreview } = await import("../settleCanvasPreview");
const artist = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("MUSICNERD_CANVAS_PREVIEW_ENABLED", "1");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T05:00:00Z"));
  await client.exec(
    "create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_kind text,action text,trigger text,parent_activity_id uuid)",
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await client.close();
});
it("keeps legacy reservations, settles once, and reuses only confirmed headroom", async () => {
  const ids = [];
  for (let i = 0; i < 18; i++) ids.push(await reserveCanvasPreview(artist));
  await expect(reserveCanvasPreview(artist)).rejects.toThrow("exhausted");
  await settleCanvasPreview(ids[0], { inputTokens: 10000, outputTokens: 1000 });
  await settleCanvasPreview(ids[0], { inputTokens: 1, outputTokens: 1 });
  // 17 full dollars + .042 leaves less than a whole dollar, so another call is still denied.
  await expect(reserveCanvasPreview(artist)).rejects.toThrow("exhausted");
  await settleCanvasPreview(ids[1], { inputTokens: 10000, outputTokens: 1000 });
  await reserveCanvasPreview(artist);
  const rows = await client.query<{ action: string; n: number }>(
    "select action,count(*)::int n from artist_activity_events group by action",
  );
  expect(rows.rows).toEqual(
    expect.arrayContaining([
      { action: "canvas_preview_reservation", n: 19 },
      { action: "canvas_preview_settlement", n: 2 },
    ]),
  );
  const settlements = await client.query<{ trigger: string }>(
    "select trigger from artist_activity_events where action='canvas_preview_settlement'",
  );
  expect(settlements.rows.every(row => row.trigger === "demo_20261029_usd_micro:42000")).toBe(true);
});

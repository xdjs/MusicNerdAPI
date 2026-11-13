import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  },
}));
const { queueUnitSync } = await import("@/lib/units/queueUnitSync");

const artist = "00000000-0000-4000-8000-000000000001";
const jobs = async () =>
  (
    await client.query<{ status: string; state: Record<string, unknown> | null }>(
      `select status, state from artist_research_jobs where kind = 'unit_sync' order by created_at, id`,
    )
  ).rows;

beforeAll(async () => {
  await client.exec(`
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',cursor integer default 0,total integer,claimed_at timestamptz,attempts integer default 0,last_error text,state jsonb,activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
    create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
  `);
}, 30000);
beforeEach(async () => client.exec(`delete from artist_research_jobs`));
afterAll(async () => client.close());

describe("queueUnitSync against Postgres", () => {
  it("queues a job when none is live", async () => {
    expect(await queueUnitSync(artist)).toBe(true);
    expect(await jobs()).toEqual([{ status: "pending", state: null }]);
  });

  it("sets rescan on a running job, keeps its state, and reports not newly queued", async () => {
    await client.query(
      `insert into artist_research_jobs(artist_id,kind,status,state) values($1,'unit_sync','running',$2)`,
      [artist, { after: { sourceKind: "vault", sourceId: "x" }, failures: 1 }],
    );
    expect(await queueUnitSync(artist)).toBe(false);
    expect(await jobs()).toEqual([
      {
        status: "running",
        state: { after: { sourceKind: "vault", sourceId: "x" }, failures: 1, rescan: true },
      },
    ]);
  });

  it("sets rescan on a pending job whose state is null", async () => {
    await queueUnitSync(artist);
    expect(await queueUnitSync(artist)).toBe(false);
    expect(await jobs()).toEqual([{ status: "pending", state: { rescan: true } }]);
  });

  it("queues a fresh job beside a finished one", async () => {
    await client.query(
      `insert into artist_research_jobs(artist_id,kind,status,state) values($1,'unit_sync','done','{}')`,
      [artist],
    );
    expect(await queueUnitSync(artist)).toBe(true);
    expect((await jobs()).map(j => j.status).sort()).toEqual(["done", "pending"]);
  });
});

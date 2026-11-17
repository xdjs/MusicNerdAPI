import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const client = new PGlite();
const driver = drizzle(client);
const execute = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: async (q: Parameters<typeof driver.execute>[0]) => {
      if (execute.fail)
        throw Object.assign(new Error("Failed query: params: secret"), {
          name: "DrizzleQueryError",
        });
      return (await driver.execute(q)).rows;
    },
  },
}));
const { saveUnitSyncProgress } = await import("@/lib/units/saveUnitSyncProgress");

const artist = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000099";
const row = async () =>
  (
    await client.query<{
      status: string;
      state: Record<string, unknown>;
      claimed: boolean;
      cursor: number;
      total: number;
      attempts: number;
    }>(
      `select status, state, claimed_at is not null as claimed, cursor, total, attempts from artist_research_jobs where id = $1`,
      [jobId],
    )
  ).rows[0];

beforeAll(async () => {
  await client.exec(`
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',cursor integer default 0,total integer,claimed_at timestamptz,attempts integer default 0,last_error text,state jsonb,activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
  `);
}, 30000);
beforeEach(async () => {
  execute.fail = false;
  await client.exec(`delete from artist_research_jobs`);
});
afterAll(async () => client.close());

const seed = (state: Record<string, unknown>) =>
  client.query(
    `insert into artist_research_jobs(id,artist_id,kind,status,state,claimed_at,attempts) values($1,$2,'unit_sync','running',$3,now(),2)`,
    [jobId, artist, state],
  );

describe("saveUnitSyncProgress", () => {
  it("writes cursor, total and state and hands the lease back", async () => {
    await seed({ failures: 0 });
    await saveUnitSyncProgress(jobId, 3, 9, {
      failures: 1,
      after: { sourceKind: "vault", sourceId: "x" },
    });
    expect(await row()).toEqual({
      status: "pending",
      state: { failures: 1, after: { sourceKind: "vault", sourceId: "x" } },
      claimed: false,
      cursor: 3,
      total: 9,
      attempts: 0,
    });
  });

  it("keeps a rescan that arrived during the slice", async () => {
    await seed({ failures: 0, rescan: true });
    await saveUnitSyncProgress(jobId, 3, 9, { failures: 1 });
    expect((await row()).state).toEqual({ failures: 1, rescan: true });
  });

  it("logs the error name only when the write fails", async () => {
    await seed({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    execute.fail = true;
    await expect(saveUnitSyncProgress(jobId, 0, 0, {})).resolves.toBeUndefined();
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("DrizzleQueryError");
    expect(logged).not.toContain("secret");
    warn.mockRestore();
  });
});

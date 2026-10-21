import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const pg = vi.hoisted(() => ({ client: undefined as unknown as PGlite }));
vi.mock("@/lib/db/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  pg.client = new PGlite();
  return { db: drizzle(pg.client, { schema }) };
});
const { upsertHeartbeat } = await import("@/lib/agentReports/upsertHeartbeat");

// agent_heartbeats as it exists on the staging database.
beforeAll(async () => {
  await pg.client.exec(`
    create table agent_heartbeats (
      id uuid primary key default gen_random_uuid(),
      worker_id text not null constraint agent_heartbeats_worker_id_key unique,
      api_key_hash text not null, status text not null default 'starting',
      current_run integer, batch_platform text, batch_size integer, message text,
      started_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      config jsonb
    );
  `);
}, 30000);
beforeEach(async () => pg.client.exec("delete from agent_heartbeats"));
afterAll(async () => pg.client.close());

type Row = Record<string, unknown> & { started_at: Date; updated_at: Date };
const rows = async () =>
  (
    await pg.client.query<Row>(
      "select worker_id, api_key_hash, status, current_run, batch_platform, batch_size, message, config, started_at, updated_at from agent_heartbeats",
    )
  ).rows;

const full = {
  workerId: "w1",
  apiKeyHash: "hash123",
  status: "running" as const,
  currentRun: 5,
  batchPlatform: "deezer",
  batchSize: 50,
  message: "Run 5 starting",
  config: { batchTimeout: 1200 },
};

describe("upsertHeartbeat", () => {
  it("inserts every field, the config as a JSON object, started_at and updated_at now", async () => {
    await upsertHeartbeat(full);
    const [row] = await rows();
    expect(row).toMatchObject({
      worker_id: "w1",
      api_key_hash: "hash123",
      status: "running",
      current_run: 5,
      batch_platform: "deezer",
      batch_size: 50,
      message: "Run 5 starting",
      config: { batchTimeout: 1200 },
    });
    expect(Date.now() - row.started_at.getTime()).toBeLessThan(60_000);
    expect(row.updated_at.getTime()).toBe(row.started_at.getTime());
  });

  it("stores omitted optional fields as null", async () => {
    await upsertHeartbeat({ workerId: "w1", apiKeyHash: "hash123", status: "idle" });
    expect(await rows()).toMatchObject([
      {
        status: "idle",
        current_run: null,
        batch_platform: null,
        batch_size: null,
        message: null,
        config: null,
      },
    ]);
  });

  it("on a repeat heartbeat replaces every field (omitted ones become null), moves updated_at and keeps started_at", async () => {
    await upsertHeartbeat(full);
    await pg.client.exec(
      "update agent_heartbeats set started_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'",
    );
    await upsertHeartbeat({ workerId: "w1", apiKeyHash: "hash456", status: "stopping" });
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      api_key_hash: "hash456",
      status: "stopping",
      current_run: null,
      batch_platform: null,
      batch_size: null,
      message: null,
      config: null,
    });
    expect(all[0].started_at.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(all[0].updated_at.getTime()).toBeGreaterThan(Date.parse("2026-01-02T00:00:00Z"));
  });
});

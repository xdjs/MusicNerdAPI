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
const { upsertRun } = await import("@/lib/agentReports/upsertRun");

// agent_runs as it exists on the staging database.
beforeAll(async () => {
  await pg.client.exec(`
    create table agent_runs (
      id uuid primary key default gen_random_uuid(),
      worker_id text not null, api_key_hash text not null, run_number integer not null,
      platform text not null default 'deezer', status text not null default 'running',
      started_at timestamptz not null default now(), ended_at timestamptz,
      wall_time_secs integer, claude_time_secs integer, api_time_secs integer, turns integer,
      batch_size integer, resolved integer default 0, excluded integer default 0,
      skipped integer default 0, errors integer default 0, high_confidence integer default 0,
      medium_confidence integer default 0, conflicts integer default 0,
      name_mismatches integer default 0, too_ambiguous integer default 0,
      exit_code integer, fail_category text, fail_reason text,
      created_at timestamptz not null default now()
    );
    create unique index idx_agent_runs_worker_run on agent_runs (worker_id, run_number);
  `);
}, 30000);
beforeEach(async () => pg.client.exec("delete from agent_runs"));
afterAll(async () => pg.client.close());

const columns = `worker_id, api_key_hash, run_number, platform, status,
  to_char(started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') as started_at,
  to_char(ended_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') as ended_at,
  wall_time_secs, claude_time_secs, api_time_secs, turns, batch_size, resolved, excluded,
  skipped, errors, high_confidence, medium_confidence, conflicts, name_mismatches,
  too_ambiguous, exit_code, fail_category, fail_reason`;
const rows = async () =>
  (await pg.client.query<Record<string, unknown>>(`select ${columns} from agent_runs`)).rows;

const full = {
  workerId: "w1",
  apiKeyHash: "hash123",
  runNumber: 5,
  platform: "apple_music",
  status: "success" as const,
  startedAt: "2026-03-25T12:00:00Z",
  endedAt: "2026-03-25T12:05:00Z",
  wallTimeSecs: 300,
  claudeTimeSecs: 280,
  apiTimeSecs: 290,
  turns: 25,
  batchSize: 50,
  resolved: 10,
  excluded: 2,
  skipped: 3,
  errors: 1,
  highConfidence: 8,
  mediumConfidence: 2,
  conflicts: 4,
  nameMismatches: 1,
  tooAmbiguous: 1,
  exitCode: 3,
  failCategory: "timeout",
  failReason: "slow",
};
const fullRow = {
  worker_id: "w1",
  api_key_hash: "hash123",
  run_number: 5,
  platform: "apple_music",
  status: "success",
  started_at: "2026-03-25T12:00:00",
  ended_at: "2026-03-25T12:05:00",
  wall_time_secs: 300,
  claude_time_secs: 280,
  api_time_secs: 290,
  turns: 25,
  batch_size: 50,
  resolved: 10,
  excluded: 2,
  skipped: 3,
  errors: 1,
  high_confidence: 8,
  medium_confidence: 2,
  conflicts: 4,
  name_mismatches: 1,
  too_ambiguous: 1,
  exit_code: 3,
  fail_category: "timeout",
  fail_reason: "slow",
};

describe("upsertRun", () => {
  it("inserts every reported column", async () => {
    await upsertRun(full);
    expect(await rows()).toEqual([fullRow]);
  });

  it("defaults platform to deezer, counts to 0 and the rest to null", async () => {
    await upsertRun({
      workerId: "w1",
      apiKeyHash: "hash123",
      runNumber: 1,
      status: "running",
      startedAt: "2026-03-25T12:00:00Z",
    });
    expect(await rows()).toEqual([
      {
        ...fullRow,
        run_number: 1,
        platform: "deezer",
        status: "running",
        ended_at: null,
        wall_time_secs: null,
        claude_time_secs: null,
        api_time_secs: null,
        turns: null,
        batch_size: null,
        resolved: 0,
        excluded: 0,
        skipped: 0,
        errors: 0,
        high_confidence: 0,
        medium_confidence: 0,
        conflicts: 0,
        name_mismatches: 0,
        too_ambiguous: 0,
        exit_code: null,
        fail_category: null,
        fail_reason: null,
      },
    ]);
  });

  it("on a repeat report keeps the stored timings, batch size, exit code and failure fields it omits, and replaces status and counts", async () => {
    await upsertRun(full);
    await upsertRun({
      workerId: "w1",
      apiKeyHash: "other-hash",
      runNumber: 5,
      platform: "tidal",
      status: "failed",
      startedAt: "2026-03-26T00:00:00Z",
    });
    expect(await rows()).toEqual([
      {
        ...fullRow,
        status: "failed",
        resolved: 0,
        excluded: 0,
        skipped: 0,
        errors: 0,
        high_confidence: 0,
        medium_confidence: 0,
        conflicts: 0,
        name_mismatches: 0,
        too_ambiguous: 0,
      },
    ]);
  });

  it("on a repeat report replaces the COALESCE fields when they are sent", async () => {
    await upsertRun(full);
    await upsertRun({
      ...full,
      endedAt: "2026-03-25T13:00:00Z",
      wallTimeSecs: 1,
      claudeTimeSecs: 2,
      apiTimeSecs: 3,
      turns: 4,
      batchSize: 5,
      exitCode: 0,
      failCategory: "none",
      failReason: "fixed",
    });
    expect(await rows()).toEqual([
      {
        ...fullRow,
        ended_at: "2026-03-25T13:00:00",
        wall_time_secs: 1,
        claude_time_secs: 2,
        api_time_secs: 3,
        turns: 4,
        batch_size: 5,
        exit_code: 0,
        fail_category: "none",
        fail_reason: "fixed",
      },
    ]);
  });

  it("keeps a different run number as its own row", async () => {
    await upsertRun(full);
    await upsertRun({ ...full, runNumber: 6 });
    expect((await rows()).map(row => row.run_number)).toEqual([5, 6]);
  });
});

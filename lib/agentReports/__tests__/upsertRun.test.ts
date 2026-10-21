import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: SQL) => []) }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { upsertRun } = await import("@/lib/agentReports/upsertRun");

beforeEach(() => vi.clearAllMocks());

describe("upsertRun", () => {
  it("inserts all 24 columns, keyed by worker and run number", async () => {
    await upsertRun({
      workerId: "w1",
      apiKeyHash: "hash123",
      runNumber: 5,
      platform: "apple_music",
      status: "success",
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
      errors: 0,
      highConfidence: 8,
      mediumConfidence: 2,
      conflicts: 0,
      nameMismatches: 1,
      tooAmbiguous: 1,
      exitCode: 0,
      failCategory: "timeout",
      failReason: "slow",
    });
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain(
      "INSERT INTO agent_runs ( worker_id, api_key_hash, run_number, platform, status, started_at, ended_at, wall_time_secs, claude_time_secs, api_time_secs, turns, batch_size, resolved, excluded, skipped, errors, high_confidence, medium_confidence, conflicts, name_mismatches, too_ambiguous, exit_code, fail_category, fail_reason )",
    );
    expect(text).toContain(
      "ON CONFLICT (worker_id, run_number) DO UPDATE SET status = EXCLUDED.status",
    );
    expect(params).toEqual([
      "w1",
      "hash123",
      5,
      "apple_music",
      "success",
      "2026-03-25T12:00:00Z",
      "2026-03-25T12:05:00Z",
      300,
      280,
      290,
      25,
      50,
      10,
      2,
      3,
      0,
      8,
      2,
      0,
      1,
      1,
      0,
      "timeout",
      "slow",
    ]);
  });

  it("defaults platform to deezer, counts to 0 and the rest to null", async () => {
    await upsertRun({
      workerId: "w1",
      apiKeyHash: "hash123",
      runNumber: 1,
      status: "running",
      startedAt: "2026-03-25T12:00:00Z",
    });
    expect(renderSql(execute.mock.calls[0][0]).params).toEqual([
      "w1",
      "hash123",
      1,
      "deezer",
      "running",
      "2026-03-25T12:00:00Z",
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      null,
    ]);
  });

  it("keeps stored timings, batch size, exit code and failure fields when a later report omits them, and replaces the counts", async () => {
    await upsertRun({
      workerId: "w1",
      apiKeyHash: "hash123",
      runNumber: 1,
      status: "failed",
      startedAt: "2026-03-25T12:00:00Z",
    });
    const { text } = renderSql(execute.mock.calls[0][0]);
    for (const column of [
      "ended_at",
      "wall_time_secs",
      "claude_time_secs",
      "api_time_secs",
      "turns",
      "batch_size",
      "exit_code",
      "fail_category",
      "fail_reason",
    ])
      expect(text).toContain(`${column} = COALESCE(EXCLUDED.${column}, agent_runs.${column})`);
    for (const column of [
      "resolved",
      "excluded",
      "skipped",
      "errors",
      "high_confidence",
      "medium_confidence",
      "conflicts",
      "name_mismatches",
      "too_ambiguous",
    ])
      expect(text).toContain(`${column} = EXCLUDED.${column}`);
  });
});

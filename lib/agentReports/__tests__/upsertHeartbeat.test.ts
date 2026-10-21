import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: SQL) => []) }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { upsertHeartbeat } = await import("@/lib/agentReports/upsertHeartbeat");

beforeEach(() => vi.clearAllMocks());

describe("upsertHeartbeat", () => {
  it("upserts by worker_id with every field, the config as jsonb, and updated_at = now()", async () => {
    await upsertHeartbeat({
      workerId: "w1",
      apiKeyHash: "hash123",
      status: "running",
      currentRun: 5,
      batchPlatform: "deezer",
      batchSize: 50,
      message: "Run 5 starting",
      config: { batchTimeout: 1200 },
    });
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain(
      "INSERT INTO agent_heartbeats (worker_id, api_key_hash, status, current_run, batch_platform, batch_size, message, config, started_at, updated_at)",
    );
    expect(text).toContain("$8::jsonb, now(), now())");
    expect(text).toContain(
      "ON CONFLICT (worker_id) DO UPDATE SET api_key_hash = EXCLUDED.api_key_hash",
    );
    expect(text).toContain("config = EXCLUDED.config, updated_at = now()");
    expect(params).toEqual([
      "w1",
      "hash123",
      "running",
      5,
      "deezer",
      50,
      "Run 5 starting",
      '{"batchTimeout":1200}',
    ]);
  });

  it("writes null for every omitted optional field", async () => {
    await upsertHeartbeat({ workerId: "w1", apiKeyHash: "hash123", status: "idle" });
    expect(renderSql(execute.mock.calls[0][0]).params).toEqual([
      "w1",
      "hash123",
      "idle",
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

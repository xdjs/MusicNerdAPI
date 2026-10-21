import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getActiveWorkers } from "@/lib/agentWork/getActiveWorkers";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getActiveWorkers", () => {
  it("maps each heartbeat with its computed status", async () => {
    mock.execute.mockResolvedValueOnce([
      {
        id: "hb1",
        worker_id: "614537",
        api_key_hash: "h1",
        status: "stopping",
        computed_status: "stopped",
        current_run: 3,
        batch_platform: "deezer",
        batch_size: 25,
        message: null,
        started_at: "2026-10-21 12:40:00+00",
        updated_at: "2026-10-21 14:02:11+00",
        config: { batchTimeout: 900 },
      },
    ]);
    expect(await getActiveWorkers()).toEqual([
      {
        workerId: "614537",
        apiKeyHash: "h1",
        status: "stopping",
        computedStatus: "stopped",
        currentRun: 3,
        batchPlatform: "deezer",
        batchSize: 25,
        message: null,
        startedAt: "2026-10-21 12:40:00+00",
        updatedAt: "2026-10-21 14:02:11+00",
        config: { batchTimeout: 900 },
      },
    ]);
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("WHEN status = 'error' THEN 'error'");
    expect(text).toContain("COALESCE((config->>'batchTimeout')::int, 900) + 120");
    expect(text).toContain("FROM agent_heartbeats ORDER BY updated_at DESC");
  });

  it("is empty without workers", async () => {
    mock.execute.mockResolvedValueOnce([]);
    expect(await getActiveWorkers()).toEqual([]);
  });
});

import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getActiveWorkers } = await import("@/lib/agentWork/getActiveWorkers");

describe("getActiveWorkers", () => {
  it("maps heartbeats with their computed status", async () => {
    execute.mockResolvedValueOnce([
      {
        worker_id: "w1",
        api_key_hash: "h",
        status: "running",
        computed_status: "dead",
        current_run: 3,
        batch_platform: "deezer",
        batch_size: 10,
        message: null,
        started_at: "s",
        updated_at: "u",
        config: { batchTimeout: 60 },
      },
    ]);
    expect(await getActiveWorkers()).toEqual([
      {
        workerId: "w1",
        apiKeyHash: "h",
        status: "running",
        computedStatus: "dead",
        currentRun: 3,
        batchPlatform: "deezer",
        batchSize: 10,
        message: null,
        startedAt: "s",
        updatedAt: "u",
        config: { batchTimeout: 60 },
      },
    ]);
  });
});

import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getRunHistory } = await import("@/lib/agentWork/getRunHistory");

describe("getRunHistory", () => {
  it("maps runs and the total", async () => {
    execute.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      {
        worker_id: "w1",
        run_number: 2,
        platform: "deezer",
        status: "done",
        started_at: "s",
        ended_at: "e",
        wall_time_secs: 10,
        claude_time_secs: 8,
        api_time_secs: 1,
        turns: 4,
        batch_size: 20,
        resolved: 15,
        excluded: 3,
        skipped: 1,
        errors: 1,
        high_confidence: 10,
        medium_confidence: 5,
        conflicts: 1,
        name_mismatches: 1,
        too_ambiguous: 1,
        exit_code: 0,
        fail_category: null,
        fail_reason: null,
      },
    ]);
    const { runs, total } = await getRunHistory();
    expect(total).toBe(1);
    expect(runs[0]).toMatchObject({
      workerId: "w1",
      runNumber: 2,
      wallTimeSecs: 10,
      highConfidence: 10,
      nameMismatches: 1,
      tooAmbiguous: 1,
      exitCode: 0,
    });
  });
});

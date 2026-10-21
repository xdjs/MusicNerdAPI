import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getRunHistory } from "@/lib/agentWork/getRunHistory";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

const row = {
  worker_id: "614537",
  run_number: 3,
  platform: "deezer",
  status: "completed",
  started_at: "2026-10-21 13:30:00+00",
  ended_at: "2026-10-21 13:42:10+00",
  wall_time_secs: 730,
  claude_time_secs: 610,
  api_time_secs: 90,
  turns: 41,
  batch_size: 25,
  resolved: 20,
  excluded: 3,
  skipped: 2,
  errors: 0,
  high_confidence: 15,
  medium_confidence: 5,
  conflicts: 1,
  name_mismatches: 1,
  too_ambiguous: 1,
  exit_code: 0,
  fail_category: null,
  fail_reason: null,
};

beforeEach(() => vi.clearAllMocks());

describe("getRunHistory", () => {
  it("maps runs newest first with the total", async () => {
    mock.execute.mockResolvedValueOnce([{ total: 3 }]).mockResolvedValueOnce([row]);
    expect(await getRunHistory()).toEqual({
      total: 3,
      runs: [
        {
          workerId: "614537",
          runNumber: 3,
          platform: "deezer",
          status: "completed",
          startedAt: "2026-10-21 13:30:00+00",
          endedAt: "2026-10-21 13:42:10+00",
          wallTimeSecs: 730,
          claudeTimeSecs: 610,
          apiTimeSecs: 90,
          turns: 41,
          batchSize: 25,
          resolved: 20,
          excluded: 3,
          skipped: 2,
          errors: 0,
          highConfidence: 15,
          mediumConfidence: 5,
          conflicts: 1,
          nameMismatches: 1,
          tooAmbiguous: 1,
          exitCode: 0,
          failCategory: null,
          failReason: null,
        },
      ],
    });
    const page = renderSql(mock.execute.mock.calls[1][0] as SQL);
    expect(page.text).toContain("FROM agent_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2");
    expect(page.params).toEqual([50, 0]);
  });

  it("passes the limit and offset through", async () => {
    mock.execute.mockResolvedValue([]);
    expect(await getRunHistory(10, 20)).toEqual({ total: 0, runs: [] });
    expect(renderSql(mock.execute.mock.calls[1][0] as SQL).params).toEqual([10, 20]);
  });
});

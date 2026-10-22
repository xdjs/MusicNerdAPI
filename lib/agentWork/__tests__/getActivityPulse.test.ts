import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getActivityPulse } from "@/lib/agentWork/getActivityPulse";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getActivityPulse", () => {
  it("reads the last write and the last hour's distinct artists from the audit log", async () => {
    mock.execute.mockResolvedValueOnce([
      { last_write_at: "2026-10-21 14:02:11+00", rate_last_hour: 4 },
    ]);
    expect(await getActivityPulse()).toEqual({
      lastWriteAt: "2026-10-21 14:02:11+00",
      rateLastHour: 4,
    });
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("MAX(created_at) AS last_write_at");
    expect(text).toContain(
      "COUNT(DISTINCT artist_id) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')",
    );
    expect(text).toContain("FROM mcp_audit_log");
  });

  it("is null and 0 with an empty log", async () => {
    mock.execute.mockResolvedValueOnce([{ last_write_at: null, rate_last_hour: 0 }]);
    expect(await getActivityPulse()).toEqual({ lastWriteAt: null, rateLastHour: 0 });
    mock.execute.mockResolvedValueOnce([]);
    expect(await getActivityPulse()).toEqual({ lastWriteAt: null, rateLastHour: 0 });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getHourlyActivity } from "@/lib/agentWork/getHourlyActivity";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getHourlyActivity", () => {
  it("maps each hour's resolve and exclude counts over the last 24 hours", async () => {
    mock.execute.mockResolvedValueOnce([
      { hour: "2026-10-21 13:00:00+00", resolve_count: 12, exclude_count: 3 },
    ]);
    expect(await getHourlyActivity()).toEqual([
      { hour: "2026-10-21 13:00:00+00", resolveCount: 12, excludeCount: 3 },
    ]);
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("date_trunc('hour', created_at) AS hour");
    expect(text).toContain("WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1");
  });
});

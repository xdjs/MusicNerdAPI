import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getLinkTodayCounts } from "@/lib/artistData/getLinkTodayCounts";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getLinkTodayCounts", () => {
  it("counts distinct artists per field from today's MCP set writes", async () => {
    mock.execute.mockResolvedValueOnce([
      { field: "instagram", today: 4 },
      { field: "x", today: 1 },
    ]);
    const counts = await getLinkTodayCounts();
    expect([...counts.entries()]).toEqual([
      ["instagram", 4],
      ["x", 1],
    ]);
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("COUNT(DISTINCT artist_id)::int AS today FROM mcp_audit_log");
    expect(text).toContain("WHERE action = 'set' AND created_at >= CURRENT_DATE GROUP BY field");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getAuditLog } from "@/lib/agentWork/getAuditLog";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

const row = {
  id: "e1",
  artist_id: "a1",
  artist_name: "Bio Ritmo",
  field: "deezer",
  action: "resolve",
  old_value: null,
  new_value: "12345",
  agent_label: "e2e-test",
  created_at: "2026-10-21 14:02:11+00",
};

beforeEach(() => vi.clearAllMocks());

describe("getAuditLog", () => {
  it("reads a page newest first with the artist name and key label", async () => {
    mock.execute.mockResolvedValueOnce([{ total: 120 }]).mockResolvedValueOnce([row]);
    expect(await getAuditLog(2, 50)).toEqual({
      entries: [
        {
          id: "e1",
          artistId: "a1",
          artistName: "Bio Ritmo",
          field: "deezer",
          action: "resolve",
          oldValue: null,
          newValue: "12345",
          agentLabel: "e2e-test",
          createdAt: "2026-10-21 14:02:11+00",
        },
      ],
      total: 120,
      page: 2,
      limit: 50,
    });
    const page = renderSql(mock.execute.mock.calls[1][0] as SQL);
    expect(page.text).toContain("LEFT JOIN artists a ON a.id = al.artist_id");
    expect(page.text).toContain("LEFT JOIN mcp_api_keys k ON k.key_hash = al.api_key_hash");
    expect(page.text).toContain("ORDER BY al.created_at DESC LIMIT $1 OFFSET $2");
    expect(page.params).toEqual([50, 50]);
  });

  it("clamps the page to 1 and the limit to 1–200", async () => {
    mock.execute.mockResolvedValue([]);
    expect(await getAuditLog(0, 500)).toMatchObject({ page: 1, limit: 200, total: 0, entries: [] });
    expect(renderSql(mock.execute.mock.calls[1][0] as SQL).params).toEqual([200, 0]);
    expect(await getAuditLog(-3, -7)).toMatchObject({ page: 1, limit: 1 });
  });

  it("defaults to the first page of 50", async () => {
    mock.execute.mockResolvedValue([]);
    expect(await getAuditLog()).toMatchObject({ page: 1, limit: 50 });
  });
});

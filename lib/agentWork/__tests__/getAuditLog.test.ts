import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getAuditLog } = await import("@/lib/agentWork/getAuditLog");

const row = {
  id: "l1",
  artist_id: "a1",
  artist_name: "Pete",
  field: "deezer",
  action: "resolve",
  old_value: null,
  new_value: "1",
  agent_label: "bot",
  created_at: "t",
};

beforeEach(() => execute.mockReset());

describe("getAuditLog", () => {
  it("maps a page of entries", async () => {
    execute.mockResolvedValueOnce([{ total: 120 }]).mockResolvedValueOnce([row]);
    expect(await getAuditLog(2, 50)).toEqual({
      entries: [
        {
          id: "l1",
          artistId: "a1",
          artistName: "Pete",
          field: "deezer",
          action: "resolve",
          oldValue: null,
          newValue: "1",
          agentLabel: "bot",
          createdAt: "t",
        },
      ],
      total: 120,
      page: 2,
      limit: 50,
    });
    expect(new PgDialect().sqlToQuery(execute.mock.calls[1][0] as SQL).params).toEqual([50, 50]);
  });

  it("clamps the page and limit", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await getAuditLog(0, 999)).toMatchObject({ total: 0, page: 1, limit: 200 });
  });
});

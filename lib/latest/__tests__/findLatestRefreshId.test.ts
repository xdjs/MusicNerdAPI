import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { findLatestRefreshId } from "@/lib/latest/findLatestRefreshId";

const execute = vi.fn();
const tx = { execute } as never;

beforeEach(() => {
  execute.mockReset().mockResolvedValue([]);
});

describe("findLatestRefreshId", () => {
  it("returns the live or cooling-down request still in scope", async () => {
    execute.mockResolvedValueOnce([{ id: "job-1" }]);
    expect(await findLatestRefreshId(tx, "a1")).toBe("job-1");
    const { sql, params } = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(params).toEqual(["a1"]);
    expect(sql).toContain("j.kind='latest_refresh'");
    expect(sql).toContain(
      "j.status in ('pending','running') or j.created_at>now()-interval '30 minutes'",
    );
    expect(sql).toContain("j.state ? 'claimId'");
  });

  it("returns null when there is none", async () => {
    expect(await findLatestRefreshId(tx, "a1")).toBeNull();
  });
});

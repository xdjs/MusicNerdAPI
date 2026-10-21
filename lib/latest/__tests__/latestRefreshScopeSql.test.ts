import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { latestRefreshScopeSql } from "@/lib/latest/latestRefreshScopeSql";

describe("latestRefreshScopeSql", () => {
  it("binds the job to the current claim, a user who still holds it, and the connected identities", () => {
    const { sql, params } = new PgDialect().sqlToQuery(latestRefreshScopeSql());
    expect(params).toEqual([]);
    expect(sql).toContain("j.state ? 'claimId'");
    expect(sql).toContain("c.status='approved'");
    expect(sql).toContain("is not distinct from (j.state->>'claimId')");
    expect(sql).toContain("u.is_admin or exists");
    for (const source of ["instagram", "inprocess", "spotify", "deezer"])
      expect(sql).toContain(`coalesce(a.${source},'')=j.state->>'${source}'`);
  });
});

import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { getClaimById } from "@/lib/claims/getClaimById";

const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));

describe("getClaimById", () => {
  it("reads the claim with its reference code", async () => {
    m.execute.mockResolvedValueOnce([{ id: "c1" }]);
    expect(await getClaimById("c1")).toEqual({ id: "c1" });
    const { sql, params } = new PgDialect().sqlToQuery(m.execute.mock.calls[0][0]);
    expect(sql).toContain('reference_code as "referenceCode"');
    expect(params).toEqual(["c1"]);
  });

  it("is undefined when there is none", async () => {
    m.execute.mockResolvedValueOnce([]);
    expect(await getClaimById("c1")).toBeUndefined();
  });
});

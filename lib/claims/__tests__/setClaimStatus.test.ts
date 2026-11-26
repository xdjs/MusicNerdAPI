import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { setClaimStatus } from "@/lib/claims/setClaimStatus";

const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
const render = (query: SQL) => new PgDialect().sqlToQuery(query);
beforeEach(() => vi.clearAllMocks());

describe("setClaimStatus", () => {
  it("sets the status, stamps updated_at and returns the claim", async () => {
    const claim = { id: "c1", status: "approved", referenceCode: "MN-ABCD" };
    m.execute.mockResolvedValueOnce([claim]);
    expect(await setClaimStatus("c1", "approved")).toBe(claim);
    const { sql, params } = render(m.execute.mock.calls[0][0]);
    expect(sql).toMatch(/update artist_claims\s+set status = \$1, updated_at/);
    expect(sql).toContain('reference_code as "referenceCode"');
    expect(params).toEqual(["approved", "c1"]);
  });

  it("is undefined when no claim has that id", async () => {
    m.execute.mockResolvedValueOnce([]);
    expect(await setClaimStatus("c1", "rejected")).toBeUndefined();
  });
});

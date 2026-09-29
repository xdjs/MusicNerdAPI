import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

describe("findApprovedClaim", () => {
  it("reads the artist's approved claim through the given reader", async () => {
    const findFirst = vi.fn(async () => ({ id: "claim-1", userId: "u1" }));
    const reader = { query: { artistClaims: { findFirst } } } as never;
    expect(await findApprovedClaim(reader, "artist-1")).toEqual({ id: "claim-1", userId: "u1" });
    const { sql, params } = new PgDialect().sqlToQuery(
      (findFirst.mock.calls[0] as unknown as [{ where: SQL }])[0].where,
    );
    expect(sql).toContain('"artist_claims"."artist_id" = $1');
    expect(sql).toContain('"artist_claims"."status" = $2');
    expect(params).toEqual(["artist-1", "approved"]);
  });

  it("is undefined when the artist has no approved claim", async () => {
    const reader = {
      query: { artistClaims: { findFirst: vi.fn(async () => undefined) } },
    } as never;
    expect(await findApprovedClaim(reader, "artist-1")).toBeUndefined();
  });
});

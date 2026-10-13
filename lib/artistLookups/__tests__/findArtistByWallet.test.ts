import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const limit = vi.fn();
const where = vi.fn((_condition: SQL) => ({ limit }));
vi.mock("@/lib/db/db", () => ({
  db: { select: () => ({ from: () => ({ where }) }) },
}));
const { findArtistByWallet } = await import("@/lib/artistLookups/findArtistByWallet");

beforeEach(() => vi.clearAllMocks());

describe("findArtistByWallet", () => {
  it("returns the first artist whose wallets contain the address", async () => {
    limit.mockResolvedValueOnce([{ id: "a1" }]);
    expect(await findArtistByWallet("0xabc")).toEqual({ id: "a1" });
    const { sql, params } = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(sql).toMatch(/"wallets" @>/);
    expect(params).toEqual([`{"0xabc"}`]);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("returns undefined when no wallet matches", async () => {
    limit.mockResolvedValueOnce([]);
    expect(await findArtistByWallet("0xabc")).toBeUndefined();
  });
});

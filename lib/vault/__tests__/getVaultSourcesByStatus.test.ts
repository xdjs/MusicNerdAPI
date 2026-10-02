import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const findMany = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistVaultSources: { findMany: (...a: unknown[]) => findMany(...a) } } },
}));
const { getVaultSourcesByStatus } = await import("@/lib/vault/getVaultSourcesByStatus");

beforeEach(() => {
  findMany.mockReset();
});

describe("getVaultSourcesByStatus", () => {
  it("returns the artist's sources with that status", async () => {
    findMany.mockResolvedValueOnce([{ id: "s1", url: "https://example.com/a" }]);
    expect(await getVaultSourcesByStatus("a1", "rejected")).toEqual([
      { id: "s1", url: "https://example.com/a" },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("filters by status only when one is given", async () => {
    findMany.mockResolvedValue([]);
    await getVaultSourcesByStatus("a1", "approved");
    await getVaultSourcesByStatus("a1");
    const render = (w: unknown) => new PgDialect().sqlToQuery(w as never).params;
    expect(render(findMany.mock.calls[0][0].where)).toEqual(["a1", "approved"]);
    expect(render(findMany.mock.calls[1][0].where)).toEqual(["a1"]);
  });

  it("is empty on a database error", async () => {
    findMany.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getVaultSourcesByStatus("a1", "pending")).toEqual([]);
  });
});

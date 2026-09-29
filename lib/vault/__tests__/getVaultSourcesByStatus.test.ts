import { describe, it, expect, vi, beforeEach } from "vitest";

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

  it("is empty on a database error", async () => {
    findMany.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getVaultSourcesByStatus("a1", "pending")).toEqual([]);
  });
});

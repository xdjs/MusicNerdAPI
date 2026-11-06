import { describe, it, expect, vi, beforeEach } from "vitest";

const { returning, transaction, lock } = vi.hoisted(() => ({
  returning: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
}));
const tx = { delete: vi.fn(() => ({ where: vi.fn(() => ({ returning })) })) };
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: lock }));
const { deleteVaultSources } = await import("@/lib/vault/deleteVaultSources");

beforeEach(() => {
  vi.clearAllMocks();
  transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
});

describe("deleteVaultSources", () => {
  it("deletes the artist's sources under the artist row lock and returns them", async () => {
    returning.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]);
    expect(await deleteVaultSources("a1", ["s1", "s2", "s1"])).toEqual([
      { id: "s1" },
      { id: "s2" },
    ]);
    expect(lock).toHaveBeenCalledWith(tx, "a1");
  });

  it("rethrows a failed delete", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    returning.mockRejectedValueOnce(new Error("pool"));
    await expect(deleteVaultSources("a1", ["s1"])).rejects.toThrow("pool");
    error.mockRestore();
  });

  it("rolls back and returns undefined when any id isn't the artist's", async () => {
    returning.mockResolvedValueOnce([{ id: "s1" }]);
    expect(await deleteVaultSources("a1", ["s1", "s9"])).toBeUndefined();
  });
});

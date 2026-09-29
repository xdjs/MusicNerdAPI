import { describe, it, expect, vi, beforeEach } from "vitest";

const { writeColumn, locks, lockScoped, scoped, transaction, tx } = vi.hoisted(() => {
  const tx = { name: "tx" };
  return {
    tx,
    writeColumn: vi.fn(async (_db: unknown, _a: string, _c: string, _v: string) => ({
      oldValue: null,
      artistName: "A",
    })),
    locks: vi.fn(async (_db: unknown, _a: string, _p: string, _id: string) => {}),
    lockScoped: vi.fn(async (_db: unknown, _a: string) => {}),
    scoped: vi.fn(async (_a: string, write: (t: unknown) => unknown) => write({ name: "scoped" })),
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
});
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/artistLinks/writeArtistLinkColumn", () => ({ writeArtistLinkColumn: writeColumn }));
vi.mock("@/lib/artistLinks/acquireArtistPlatformWriteLocks", () => ({
  acquireArtistPlatformWriteLocks: locks,
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: lockScoped }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
const { setArtistLink } = await import("@/lib/artistLinks/setArtistLink");

beforeEach(() => vi.clearAllMocks());

describe("setArtistLink", () => {
  it("writes an ordinary column through a scoped write", async () => {
    expect(await setArtistLink("a1", "instagram", "pete")).toEqual({
      oldValue: null,
      artistName: "A",
    });
    expect(scoped).toHaveBeenCalledWith("a1", expect.any(Function));
    expect(writeColumn).toHaveBeenCalledWith({ name: "scoped" }, "a1", "instagram", "pete");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("writes spotify and deezer in a transaction: advisory locks, then the scoped lock, then the write", async () => {
    await setArtistLink("a1", "spotify", "S1");
    expect(locks).toHaveBeenCalledWith(tx, "a1", "spotify", "S1");
    expect(lockScoped).toHaveBeenCalledWith(tx, "a1");
    expect(writeColumn).toHaveBeenCalledWith(tx, "a1", "spotify", "S1");
    expect(locks.mock.invocationCallOrder[0]).toBeLessThan(lockScoped.mock.invocationCallOrder[0]);
    expect(lockScoped.mock.invocationCallOrder[0]).toBeLessThan(
      writeColumn.mock.invocationCallOrder[0],
    );
    expect(scoped).not.toHaveBeenCalled();
  });

  it("sanitizes the column name and refuses non-link columns and empty values", async () => {
    await setArtistLink("a1", "insta-gram", "pete");
    expect(writeColumn).toHaveBeenCalledWith({ name: "scoped" }, "a1", "instagram", "pete");
    await expect(setArtistLink("a1", "wallets", "0x1")).rejects.toThrow(
      "dedicated array operations",
    );
    await expect(setArtistLink("a1", "bio", "x")).rejects.toThrow("whitelist");
    await expect(setArtistLink("a1", "!!!", "x")).rejects.toThrow("Invalid column name");
    await expect(setArtistLink("a1", "x", "")).rejects.toThrow("Value must not be empty");
  });
});

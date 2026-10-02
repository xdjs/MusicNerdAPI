import { describe, it, expect, vi, beforeEach } from "vitest";

const { clearColumn, platformLock, lockScoped, scoped, transaction, tx } = vi.hoisted(() => {
  const tx = { name: "tx" };
  return {
    tx,
    clearColumn: vi.fn(async (_db: unknown, _a: string, _c: string) => ({ oldValue: "old" })),
    platformLock: vi.fn(async (_db: unknown, _a: string, _p: string) => {}),
    lockScoped: vi.fn(async (_db: unknown, _a: string) => {}),
    scoped: vi.fn(async (_a: string, write: (t: unknown) => unknown) => write({ name: "scoped" })),
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
});
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/artistLinks/clearArtistLinkColumn", () => ({ clearArtistLinkColumn: clearColumn }));
vi.mock("@/lib/artistLinks/acquireArtistPlatformLock", () => ({
  acquireArtistPlatformLock: platformLock,
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: lockScoped }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
const { clearArtistLink } = await import("@/lib/artistLinks/clearArtistLink");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clearArtistLink", () => {
  it("clears an ordinary column through a scoped write", async () => {
    expect(await clearArtistLink("a1", "instagram")).toEqual({ oldValue: "old" });
    expect(clearColumn).toHaveBeenCalledWith({ name: "scoped" }, "a1", "instagram");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("clears spotify and deezer under the platform-slot lock, then the scoped lock", async () => {
    await clearArtistLink("a1", "deezer");
    expect(platformLock).toHaveBeenCalledWith(tx, "a1", "deezer");
    expect(lockScoped).toHaveBeenCalledWith(tx, "a1");
    expect(clearColumn).toHaveBeenCalledWith(tx, "a1", "deezer");
    expect(platformLock.mock.invocationCallOrder[0]).toBeLessThan(
      lockScoped.mock.invocationCallOrder[0],
    );
    expect(scoped).not.toHaveBeenCalled();
  });

  it("refuses a column that isn't a writable link", async () => {
    await expect(clearArtistLink("a1", "name")).rejects.toThrow();
    expect(clearColumn).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { lock, tx, transaction, plainDb } = vi.hoisted(() => {
  const tx = { name: "tx" };
  return {
    lock: vi.fn(),
    tx,
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    plainDb: {} as Record<string, unknown>,
  };
});
vi.mock("@/lib/db/db", () => {
  plainDb.transaction = transaction;
  return { db: plainDb };
});
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: lock }));
const { withScopedArtistWrite } = await import("@/lib/ownership/withScopedArtistWrite");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");

beforeEach(() => {
  lock.mockReset().mockResolvedValue(undefined);
  transaction.mockClear();
});

describe("withScopedArtistWrite", () => {
  it("writes with the plain client outside an operation", async () => {
    const write = vi.fn(async () => "saved");
    expect(await withScopedArtistWrite("a1", write)).toBe("saved");
    expect(write).toHaveBeenCalledWith(plainDb);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("inside an operation, locks and reauthorizes in a transaction before the write", async () => {
    const write = vi.fn(async () => "saved");
    const result = await withArtistOperation("a1", { expectedClaimId: "c1" }, () =>
      withScopedArtistWrite("a1", write),
    );
    expect(result).toBe("saved");
    expect(lock).toHaveBeenCalledWith(tx, "a1");
    expect(write).toHaveBeenCalledWith(tx);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[0]);
  });

  it("never writes when the reauthorization fails", async () => {
    lock.mockImplementationOnce(async () => {
      throw new Error("Artist ownership changed; this operation was cancelled.");
    });
    const write = vi.fn();
    await expect(
      withArtistOperation("a1", { expectedClaimId: "c1" }, () =>
        withScopedArtistWrite("a1", write),
      ),
    ).rejects.toThrow("ownership changed");
    expect(write).not.toHaveBeenCalled();
  });
});

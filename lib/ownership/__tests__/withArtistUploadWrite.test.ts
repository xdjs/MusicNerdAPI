import { describe, it, expect, vi, beforeEach } from "vitest";

const { transaction, lockArtistRow, authorize } = vi.hoisted(() => ({
  transaction: vi.fn(),
  lockArtistRow: vi.fn(),
  authorize: vi.fn(),
}));
const tx = { execute: vi.fn() };
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: authorize,
}));
const { withArtistUploadWrite } = await import("@/lib/ownership/withArtistUploadWrite");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  transaction.mockReset().mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  lockArtistRow.mockReset();
  authorize.mockReset();
});

describe("withArtistUploadWrite", () => {
  it("locks the artist, re-authorizes the user under the expected claim, then writes in the same transaction", async () => {
    const order: string[] = [];
    lockArtistRow.mockImplementation(async () => order.push("lock"));
    authorize.mockImplementation(async () => order.push("authorize"));
    const write = vi.fn(async (t: unknown) => {
      order.push("write");
      return t === tx ? "written" : "wrong tx";
    });
    expect(await withArtistUploadWrite("a1", "u1", "c1", write)).toBe("written");
    expect(lockArtistRow).toHaveBeenCalledWith(tx, "a1");
    expect(authorize).toHaveBeenCalledWith(tx, "a1", { userId: "u1", expectedClaimId: "c1" });
    expect(order).toEqual(["lock", "authorize", "write"]);
  });

  it("does not write when ownership changed", async () => {
    authorize.mockRejectedValue(new OwnershipChangedError());
    const write = vi.fn();
    await expect(withArtistUploadWrite("a1", "u1", null, write)).rejects.toBeInstanceOf(
      OwnershipChangedError,
    );
    expect(write).not.toHaveBeenCalled();
  });
});

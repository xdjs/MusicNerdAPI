import { describe, it, expect, vi } from "vitest";

const mock = vi.hoisted(() => ({
  lock: vi.fn(),
  authorize: vi.fn(),
  tx: {} as Record<string, unknown>,
}));
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn(mock.tx) },
}));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: mock.lock }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: mock.authorize,
}));
const { unpinArtistBio } = await import("@/lib/bio/unpinArtistBio");

describe("unpinArtistBio", () => {
  it("clears every pin for the artist under the lock", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    mock.tx = { update: vi.fn(() => ({ set })) };
    const auth = { userId: "u1", expectedClaimId: "c1" };
    await unpinArtistBio("a1", auth);
    expect(mock.lock).toHaveBeenCalledWith(mock.tx, "a1");
    expect(mock.authorize).toHaveBeenCalledWith(mock.tx, "a1", auth);
    expect(set).toHaveBeenCalledWith({ isPinned: false });
    expect(where).toHaveBeenCalledTimes(1);
  });
});

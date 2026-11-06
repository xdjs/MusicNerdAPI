import { describe, it, expect, vi, beforeEach } from "vitest";

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
const { deleteBioVersion } = await import("@/lib/bio/deleteBioVersion");

const auth = { userId: "u1", expectedClaimId: null };
let version: unknown;
const returning = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  version = { id: "v1", isPinned: false };
  returning.mockResolvedValue([{ id: "v1" }]);
  mock.tx = {
    query: { artistBioVersions: { findFirst: vi.fn(async () => version) } },
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning })) })),
  };
});

describe("deleteBioVersion", () => {
  it("deletes an unpinned version under the lock", async () => {
    expect(await deleteBioVersion("v1", "a1", auth)).toBe("deleted");
    expect(mock.lock).toHaveBeenCalledWith(mock.tx, "a1");
    expect(mock.authorize).toHaveBeenCalledWith(mock.tx, "a1", auth);
    expect(mock.tx.delete).toHaveBeenCalledTimes(1);
  });

  it("reports a missing version", async () => {
    version = undefined;
    expect(await deleteBioVersion("v9", "a1", auth)).toBe("not_found");
    expect(mock.tx.delete).not.toHaveBeenCalled();
  });

  it("keeps a pinned version", async () => {
    version = { id: "v1", isPinned: true };
    expect(await deleteBioVersion("v1", "a1", auth)).toBe("pinned");
    expect(mock.tx.delete).not.toHaveBeenCalled();
  });
});

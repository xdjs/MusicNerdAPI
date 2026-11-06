import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({
  lock: vi.fn(),
  authorize: vi.fn(),
  saveVersions: vi.fn(),
  tx: {} as Record<string, unknown>,
}));
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn(mock.tx) },
}));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: mock.lock }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: mock.authorize,
}));
vi.mock("@/lib/bio/saveBioVersions", () => ({ saveBioVersions: mock.saveVersions }));
const { pinBioVersion } = await import("@/lib/bio/pinBioVersion");

const auth = { userId: "u1", expectedClaimId: "c1" };
let selected: unknown;
let updates: { set: ReturnType<typeof vi.fn>; returning: ReturnType<typeof vi.fn> }[];

beforeEach(() => {
  vi.clearAllMocks();
  selected = { id: "v2", bioText: "Pinned text" };
  updates = [];
  mock.tx = {
    query: {
      artistBioVersions: { findFirst: vi.fn(async () => selected) },
      artists: { findFirst: vi.fn(async () => ({ bio: "Current text" })) },
    },
    update: vi.fn(() => {
      const returning = vi.fn(async () => [{ id: "v2", bioText: "Pinned text" }]);
      const where = vi.fn(() => Object.assign(Promise.resolve(), { returning }));
      const set = vi.fn(() => ({ where }));
      updates.push({ set, returning });
      return { set };
    }),
  };
});

describe("pinBioVersion", () => {
  it("authorizes under the lock, keeps the current bio, pins the version and makes it the bio", async () => {
    expect(await pinBioVersion("v2", "a1", auth)).toEqual({ id: "v2", bioText: "Pinned text" });
    expect(mock.lock).toHaveBeenCalledWith(mock.tx, "a1");
    expect(mock.authorize).toHaveBeenCalledWith(mock.tx, "a1", auth);
    expect(mock.saveVersions).toHaveBeenCalledWith(mock.tx, "a1", ["Current text"]);
    expect(updates.map(u => u.set.mock.calls[0][0])).toEqual([
      { isPinned: false },
      { isPinned: true },
      { bio: "Pinned text" },
    ]);
  });

  it("returns undefined and writes nothing for a version that isn't the artist's", async () => {
    selected = undefined;
    expect(await pinBioVersion("v9", "a1", auth)).toBeUndefined();
    expect(updates).toHaveLength(0);
    expect(mock.saveVersions).not.toHaveBeenCalled();
  });

  it("refuses before reading when authorization fails", async () => {
    mock.authorize.mockRejectedValue(new Error("ownership"));
    await expect(pinBioVersion("v2", "a1", auth)).rejects.toThrow("ownership");
    expect(updates).toHaveLength(0);
  });
});

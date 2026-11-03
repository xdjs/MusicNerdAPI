import { describe, it, expect, vi, beforeEach } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";

const m = vi.hoisted(() => ({
  lockArtistRow: vi.fn(),
  readProvenance: vi.fn(),
  writeProvenance: vi.fn(),
  assertLore: vi.fn(),
  assertSources: vi.fn(),
  assertLease: vi.fn(),
  finish: vi.fn(),
  authorize: vi.fn(),
  findApprovedClaim: vi.fn(),
  record: vi.fn(),
  saveBioVersions: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/lore/assertLoreSourcesCurrent", () => ({
  assertLoreSourcesCurrent: m.assertSources,
}));
vi.mock("@/lib/bio/readBioProvenance", () => ({ readBioProvenance: m.readProvenance }));
vi.mock("@/lib/bio/writeBioProvenance", () => ({ writeBioProvenance: m.writeProvenance }));
vi.mock("@/lib/bio/assertAboutLoreCurrent", () => ({ assertAboutLoreCurrent: m.assertLore }));
vi.mock("@/lib/lore/assertLoreRefreshLease", () => ({ assertLoreRefreshLease: m.assertLease }));
vi.mock("@/lib/bio/finishAboutLoreRefresh", () => ({ finishAboutLoreRefresh: m.finish }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: m.lockArtistRow }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: m.authorize,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.findApprovedClaim }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.record }));
vi.mock("@/lib/bio/saveBioVersions", () => ({ saveBioVersions: m.saveBioVersions }));
const { persistArtistBio } = await import("@/lib/bio/persistArtistBio");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");
const { BioConflictError } = await import("@/lib/bio/BioConflictError");

function setup({
  bio = "Artist edited bio" as string | null,
  pinned = false,
  bioProvenance = null as unknown,
} = {}) {
  m.readProvenance.mockResolvedValue(bioProvenance);
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const values = vi.fn(() => ({
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  }));
  const tx = {
    execute: vi.fn().mockResolvedValue([]),
    query: {
      artists: { findFirst: vi.fn().mockResolvedValue({ id: "a1", bio }) },
      artistBioVersions: {
        findFirst: vi.fn().mockResolvedValue(pinned ? { bioText: bio } : undefined),
      },
    },
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => ({ set })),
  };
  m.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { tx, set, values };
}
const owner = { expectedClaimId: null };

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.findApprovedClaim.mockResolvedValue(undefined);
  m.finish.mockResolvedValue(true);
  m.record.mockResolvedValue("activity-1");
});

describe("persistArtistBio", () => {
  it.each([true, false])(
    "locks the row, then rejects a changed claim before any write (initiating user: %s)",
    async withUser => {
      const { tx, set } = setup({ bio: null });
      m.findApprovedClaim.mockResolvedValue({ id: "replacement-claim" });
      m.authorize.mockRejectedValue(new OwnershipChangedError());
      await expect(
        persistArtistBio("a1", "Delayed About", {
          ownership: { expectedClaimId: "old-claim", ...(withUser ? { userId: "old-owner" } : {}) },
          generated: true,
          expectedBio: null,
          document: { content: "Delayed Lore", sources: [] },
          confirmSteps: ["interview", "publish"],
        }),
      ).rejects.toThrow("ownership changed");
      expect(tx.insert).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
      expect(m.lockArtistRow).toHaveBeenCalledWith(tx, "a1");
      const check = withUser ? m.authorize : m.findApprovedClaim;
      expect(m.lockArtistRow.mock.invocationCallOrder[0]).toBeLessThan(
        check.mock.invocationCallOrder[0],
      );
    },
  );

  it("checks an initiating user with the locked-write authorization", async () => {
    const { tx } = setup();
    await persistArtistBio("a1", "New", { ownership: { expectedClaimId: "c1", userId: "u1" } });
    expect(m.authorize).toHaveBeenCalledWith(tx, "a1", { userId: "u1", expectedClaimId: "c1" });
    expect(m.findApprovedClaim).not.toHaveBeenCalled();
  });

  it("rejects a missing ownership context rather than trusting the write", async () => {
    const { tx } = setup();
    await expect(persistArtistBio("a1", "Unsafe", {} as never)).rejects.toThrow(
      "ownership changed",
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("never overwrites a pin, even when generation started before the pin", async () => {
    const { set, values } = setup({ pinned: true });
    await expect(
      persistArtistBio("a1", "AI replacement", {
        ownership: owner,
        generated: true,
        expectedBio: "Artist edited bio",
      }),
    ).rejects.toBeInstanceOf(BioConflictError);
    expect(set).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("requires an explicit unpin before a manual edit, and keeps an identical one", async () => {
    const { set } = setup({ pinned: true });
    await expect(persistArtistBio("a1", "Replacement", { ownership: owner })).rejects.toThrow(
      "Unpin",
    );
    expect(await persistArtistBio("a1", "Artist edited bio", { ownership: owner })).toBe(
      "Artist edited bio",
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("keeps a newer artist edit when a slow generation finishes", async () => {
    const { set } = setup();
    await expect(
      persistArtistBio("a1", "AI replacement", {
        ownership: owner,
        generated: true,
        expectedBio: "Old bio",
      }),
    ).rejects.toBeInstanceOf(BioConflictError);
    expect(set).not.toHaveBeenCalled();
  });

  it("saves both bios to history before the update", async () => {
    const { tx, set } = setup();
    expect(await persistArtistBio("a1", "New artist bio", { ownership: owner })).toBe(
      "New artist bio",
    );
    expect(m.saveBioVersions).toHaveBeenCalledWith(
      tx,
      "a1",
      ["Artist edited bio", "New artist bio"],
      [null, null],
    );
    expect(set).toHaveBeenCalledWith({ bio: "New artist bio" });
    expect(m.saveBioVersions.mock.invocationCallOrder[0]).toBeLessThan(
      set.mock.invocationCallOrder[0],
    );
  });

  it.each([
    [undefined, "system", "automatic_about"],
    ["editor", "user", "about_editor"],
  ])("attributes a generated About (user %s)", async (userId, actorKind, trigger) => {
    const { tx } = setup({ bio: null });
    await persistArtistBio("a1", "Generated About", {
      ownership: { expectedClaimId: null, userId },
      generated: true,
      expectedBio: null,
    });
    expect(m.record).toHaveBeenCalledWith(
      "a1",
      "about_generated",
      { userId, actorKind, trigger },
      tx,
    );
  });

  it("attributes an onboarding publish and a manual edit", async () => {
    setup({ bio: null });
    await persistArtistBio("a1", "Published", {
      ownership: { expectedClaimId: null, userId: "u1" },
      generated: true,
      expectedBio: null,
      document: { content: "Lore", sources: [] },
    });
    expect(m.record.mock.calls[0].slice(1, 3)).toEqual([
      "about_generated",
      { userId: "u1", actorKind: "user", trigger: "onboarding" },
    ]);
    setup({ bio: "Old" });
    await persistArtistBio("a1", "Typed", { ownership: { expectedClaimId: null } });
    expect(m.record.mock.calls[1].slice(1, 3)).toEqual([
      "about_edited",
      { userId: undefined, actorKind: "unknown", trigger: "about_editor" },
    ]);
  });

  it("caches the claim nudge without history, via saveBioVersions' real-bio filter", async () => {
    const { set } = setup({ bio: null });
    await persistArtistBio("a1", ABOUT_EMPTY_STATE, {
      ownership: owner,
      generated: true,
      expectedBio: null,
    });
    expect(m.saveBioVersions).toHaveBeenCalledWith(
      expect.anything(),
      "a1",
      [null, ABOUT_EMPTY_STATE],
      [null, expect.objectContaining({ kind: "unknown" })],
    );
    expect(set).toHaveBeenCalledWith({
      bio: ABOUT_EMPTY_STATE,
    });
  });

  it("publishes the document in the same transaction, before history and bio", async () => {
    const { tx, set } = setup();
    const docUpsert = vi.fn().mockResolvedValue(undefined);
    const docValues = vi.fn(() => ({ onConflictDoUpdate: docUpsert }));
    tx.insert.mockReturnValueOnce({ values: docValues } as never);
    const sources = [{ id: 1, label: "PDF" }];
    await persistArtistBio("a1", "Published About", {
      ownership: owner,
      generated: true,
      expectedBio: "Artist edited bio",
      document: { content: "Lore", sources },
    });
    expect(docValues).toHaveBeenCalledWith({ artistId: "a1", content: "Lore", sources });
    expect(docUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      m.saveBioVersions.mock.invocationCallOrder[0],
    );
    expect(docUpsert.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
    expect(m.transaction).toHaveBeenCalledTimes(1);
  });

  it("writes no bio or history when the document upsert fails", async () => {
    const { tx, set } = setup();
    tx.insert.mockReturnValueOnce({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockRejectedValue(new Error("document write failed")),
      })),
    } as never);
    await expect(
      persistArtistBio("a1", "Published About", {
        ownership: owner,
        generated: true,
        expectedBio: "Artist edited bio",
        document: { content: "Lore", sources: [] },
      }),
    ).rejects.toThrow("document write failed");
    expect(set).not.toHaveBeenCalled();
    expect(m.saveBioVersions).not.toHaveBeenCalled();
  });

  it("confirms the steps in the same transaction, even when the bio already matches", async () => {
    const { tx } = setup();
    const confirmation = vi.fn().mockResolvedValue(undefined);
    const confirmValues = vi.fn(() => ({ onConflictDoNothing: confirmation }));
    tx.insert.mockReturnValueOnce({ values: confirmValues } as never);
    await persistArtistBio("a1", "Artist edited bio", {
      ownership: owner,
      generated: true,
      expectedBio: "Artist edited bio",
      confirmSteps: ["publish"],
    });
    expect(confirmValues).toHaveBeenCalledWith({ artistId: "a1", step: "publish" });
    expect(m.writeProvenance).toHaveBeenCalledWith(
      tx,
      "a1",
      expect.objectContaining({ kind: "unknown" }),
    );
    expect(m.record).toHaveBeenCalled();
  });

  it("aborts publication if the confirmation can't be saved", async () => {
    const { tx, set } = setup();
    tx.insert.mockReturnValueOnce({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockRejectedValue(new Error("confirmation failed")),
      })),
    } as never);
    await expect(
      persistArtistBio("a1", "Draft", {
        ownership: owner,
        generated: true,
        expectedBio: "Artist edited bio",
        confirmSteps: ["publish"],
      }),
    ).rejects.toThrow("confirmation failed");
    expect(set).not.toHaveBeenCalled();
  });
});

it("revalidates the exact Lore before any About/history writes and preserves them on source change", async () => {
  const { tx, set } = setup();
  const expectedLore = { content: "Lore", sources: [] };
  m.assertLore.mockRejectedValue(new Error("Lore sources changed"));
  await expect(persistArtistBio("a1", "New", { ownership: owner, expectedLore })).rejects.toThrow(
    "Lore sources changed",
  );
  expect(m.assertLore).toHaveBeenCalledWith(tx, "a1", expectedLore);
  expect(set).not.toHaveBeenCalled();
  expect(m.saveBioVersions).not.toHaveBeenCalled();
});
it("does not publish when the deadline elapses while waiting for the artist lock", async () => {
  const { set } = setup();
  const controller = new AbortController();
  m.lockArtistRow.mockImplementation(async () => controller.abort(new Error("deadline")));
  await expect(
    persistArtistBio("a1", "New", { ownership: owner, signal: controller.signal }),
  ).rejects.toThrow("deadline");
  expect(set).not.toHaveBeenCalled();
  expect(m.saveBioVersions).not.toHaveBeenCalled();
});
it("fences and settles the About lease using the same transaction as the About write", async () => {
  const { tx, set } = setup();
  const aboutLease = { jobId: "j", requestedAt: "r", claimedAt: "lease" };
  await persistArtistBio("a1", "New", { ownership: owner, aboutLease });
  expect(m.assertLease).toHaveBeenCalledWith(tx, "a1", aboutLease);
  expect(m.finish).toHaveBeenCalledWith("a1", aboutLease, "rebuilt", tx);
  expect(m.finish.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
});
it("refuses the About write when settlement detects newer work or loses the lease", async () => {
  const { set } = setup();
  m.finish.mockResolvedValue(false);
  await expect(
    persistArtistBio("a1", "New", {
      ownership: owner,
      aboutLease: { jobId: "j", requestedAt: "r", claimedAt: "lease" },
    }),
  ).rejects.toThrow("Lore sources changed");
  expect(set).not.toHaveBeenCalled();
  expect(m.saveBioVersions).not.toHaveBeenCalled();
});

it("refuses onboarding publication after source privacy or moderation changes", async () => {
  const { tx } = setup();
  m.assertSources.mockRejectedValue(new Error("Lore sources changed"));
  await expect(
    persistArtistBio("a1", "New About", {
      ownership: owner,
      document: { content: "Lore", sources: [] },
    }),
  ).rejects.toThrow("Lore sources changed");
  expect(tx.insert).not.toHaveBeenCalled();
  expect(tx.update).not.toHaveBeenCalled();
});

it("saves fresh evidence even when regeneration produces identical text", async () => {
  const old = { version: 1, kind: "generated", bioHash: "old", claimId: null, sources: [] };
  const { tx, set } = setup({ bio: "Same", bioProvenance: old });
  const sources = [
    {
      id: 1,
      kind: "vault" as const,
      label: "Evidence",
      url: "https://example.org",
      revision: "a".repeat(64),
    },
  ];
  await persistArtistBio("a1", "Same", {
    ownership: owner,
    generated: true,
    expectedBio: "Same",
    expectedLore: { content: "Lore", sources },
  });
  expect(set).toHaveBeenCalledWith({
    bio: "Same",
  });
  expect(m.writeProvenance).toHaveBeenCalledWith(
    tx,
    "a1",
    expect.objectContaining({ kind: "generated", sources }),
  );
  expect(m.saveBioVersions).toHaveBeenCalledWith(
    tx,
    "a1",
    ["Same", "Same"],
    [old, expect.objectContaining({ sources })],
  );
});

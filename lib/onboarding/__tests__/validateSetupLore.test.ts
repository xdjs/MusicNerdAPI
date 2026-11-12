import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  lock: vi.fn(),
  auth: vi.fn(),
  snapshot: vi.fn(),
  current: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: m.lock }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: m.auth,
}));
vi.mock("@/lib/onboarding/assertSetupDocumentCurrent", () => ({
  assertSetupDocumentCurrent: m.snapshot,
}));
vi.mock("@/lib/bio/assertAboutLoreCurrent", () => ({ assertAboutLoreCurrent: m.current }));
const { validateSetupLore } = await import("../validateSetupLore");
const ownership = { userId: "owner", expectedClaimId: "claim" };
const sources = [
  {
    id: 1,
    kind: "vault",
    label: "Actual evidence",
    url: "https://example.com",
    revision: "a".repeat(64),
    publishedAt: "2026-01-01",
  },
];
const doc = { content: "Saved", sources, updatedAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({}));
});
it("reuses the exact saved manifest after ownership, snapshot and source validation", async () => {
  expect(await validateSetupLore("artist", ownership, doc)).toBe(sources);
  expect(m.auth).toHaveBeenCalledWith({}, "artist", ownership);
  expect(m.snapshot).toHaveBeenCalledWith({}, "artist", doc);
  expect(m.current).toHaveBeenCalledWith({}, "artist", { content: doc.content, sources });
});
it.each([null, [], [{ kind: "vault" }], [{ ...sources[0], revision: undefined }], [null]])(
  "refuses absent or malformed manifest %j",
  async invalid => {
    await expect(
      validateSetupLore("artist", ownership, { ...doc, sources: invalid }),
    ).rejects.toThrow("Lore sources changed");
    expect(m.transaction).not.toHaveBeenCalled();
  },
);
it("propagates changed ownership and evidence before a model can use it", async () => {
  m.auth.mockRejectedValueOnce(new Error("revoked"));
  await expect(validateSetupLore("artist", ownership, doc)).rejects.toThrow("revoked");
  expect(m.current).not.toHaveBeenCalled();
  m.current.mockRejectedValueOnce(new Error("private source"));
  await expect(validateSetupLore("artist", ownership, doc)).rejects.toThrow("private source");
});

it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid citation ID %s before any reuse",
  async id => {
    await expect(
      validateSetupLore("artist", ownership, {
        ...doc,
        sources: [{ ...sources[0], id }],
      }),
    ).rejects.toThrow("Lore sources changed");
    expect(m.transaction).not.toHaveBeenCalled();
  },
);
it("rejects duplicate citation IDs across source kinds", async () => {
  await expect(
    validateSetupLore("artist", ownership, {
      ...doc,
      sources: [sources[0], { id: 1, kind: "interview", label: "Artist", url: null }],
    }),
  ).rejects.toThrow("Lore sources changed");
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(["vault", "interview", "social"])("rejects unsafe %s URLs before reuse", async kind => {
  for (const url of [
    "https://example.com?token=private",
    "https://user:password@example.com",
    "file:///private/source",
    "not a URL",
  ]) {
    await expect(
      validateSetupLore("artist", ownership, {
        ...doc,
        sources: [{ ...sources[0], kind, url }],
      }),
    ).rejects.toThrow("Lore sources changed");
  }
  expect(m.transaction).not.toHaveBeenCalled();
});
it("keeps valid unique interview and social citations unchanged", async () => {
  const saved = [
    sources[0],
    { id: 2, kind: "interview", label: "Artist", url: null },
    { id: 3, kind: "social", label: "Public post", url: "https://example.com/post" },
  ];
  expect(await validateSetupLore("artist", ownership, { ...doc, sources: saved })).toBe(saved);
});

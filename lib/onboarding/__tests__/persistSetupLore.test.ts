import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ execute: vi.fn(), lock: vi.fn(), auth: vi.fn(), sources: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({ execute: m.execute }) },
}));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: m.lock }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: m.auth,
}));
vi.mock("@/lib/lore/assertLoreSourcesCurrent", () => ({ assertLoreSourcesCurrent: m.sources }));
const { persistSetupLore } = await import("../persistSetupLore");
const auth = { userId: "u", expectedClaimId: "c" };
const doc = { content: "New Lore", sources: [] };
beforeEach(() => {
  vi.resetAllMocks();
  m.execute
    .mockResolvedValue([])
    .mockResolvedValueOnce([{ bio: "Human About", pinned: false }])
    .mockResolvedValueOnce([]);
});
it("saves Lore and confirms setup without writing bio, history, lineage or pins", async () => {
  await persistSetupLore("a", auth, doc, null);
  expect(m.lock).toHaveBeenCalled();
  expect(m.auth).toHaveBeenCalledWith(expect.anything(), "a", auth);
  expect(m.sources).toHaveBeenCalledWith(expect.anything(), "a", [], { allowEmpty: true });
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const sql = m.execute.mock.calls.map(([q]) => dialect.sqlToQuery(q).sql).join("\n");
  expect(sql).toContain("insert into artist_docs");
  expect(sql).toContain("insert into artist_onboarding_steps");
  expect(sql).not.toMatch(/update artists|insert into artist_bio|mn_private|set is_pinned/);
});
it("rejects a concurrent Lore edit without writing", async () => {
  m.execute
    .mockReset()
    .mockResolvedValueOnce([{ bio: "Human About", pinned: false }])
    .mockResolvedValueOnce([{ content: "Edited Lore", sources: [], updatedAt: "later" }]);
  await expect(persistSetupLore("a", auth, doc, null)).rejects.toThrow("Lore sources changed");
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("refuses stale evidence and changed ownership", async () => {
  m.auth.mockRejectedValue(new Error("revoked"));
  await expect(persistSetupLore("a", auth, doc, null)).rejects.toThrow("revoked");
  expect(m.execute).not.toHaveBeenCalled();
});
it("refuses empty unpinned bio rather than silently completing a missing About", async () => {
  m.execute.mockReset().mockResolvedValueOnce([{ bio: null, pinned: false }]);
  await expect(persistSetupLore("a", auth, doc, null)).rejects.toThrow("Your bio changed");
});
it("permits a pinned bio without changing its pin", async () => {
  m.execute
    .mockReset()
    .mockResolvedValue([])
    .mockResolvedValueOnce([{ bio: null, pinned: true }])
    .mockResolvedValueOnce([]);
  await expect(persistSetupLore("a", auth, doc, null)).resolves.toBeUndefined();
});
it("propagates source validation failure before saving material", async () => {
  m.sources.mockRejectedValue(new Error("source changed"));
  await expect(persistSetupLore("a", auth, doc, null)).rejects.toThrow("source changed");
  expect(m.execute).toHaveBeenCalledTimes(2);
});

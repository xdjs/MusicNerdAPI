import { describe, it, expect, vi, beforeEach } from "vitest";

const { tx, values, upsert } = vi.hoisted(() => {
  const upsert = vi.fn();
  const values = vi.fn(() => ({ onConflictDoUpdate: upsert }));
  const tx = {
    execute: vi.fn(),
    query: { artistClaims: { findFirst: vi.fn() }, artistResearchJobs: { findFirst: vi.fn() } },
    insert: vi.fn(() => ({ values })),
  };
  return { tx, values, upsert };
});
vi.mock("@/lib/db/db", () => ({ db: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }));
const { persistRefreshedLore } = await import("@/lib/lore/persistRefreshedLore");

beforeEach(() => {
  vi.clearAllMocks();
  tx.execute.mockResolvedValue([]);
  tx.query.artistClaims.findFirst.mockResolvedValue({ id: "current-claim" });
  tx.query.artistResearchJobs.findFirst.mockResolvedValue({ id: "j1" });
  upsert.mockResolvedValue(undefined);
});

describe("persistRefreshedLore", () => {
  it.each([undefined, { id: "replacement-claim" }])(
    "writes nothing for a revoked claim (current: %j)",
    async current => {
      tx.query.artistClaims.findFirst.mockResolvedValue(current);
      expect(await persistRefreshedLore("a1", "Old doc", [], "old-claim", "j1")).toBe(false);
      expect(tx.insert).not.toHaveBeenCalled();
    },
  );

  it("writes nothing for a job that is gone", async () => {
    tx.query.artistClaims.findFirst.mockResolvedValue(undefined);
    tx.query.artistResearchJobs.findFirst.mockResolvedValue(undefined);
    expect(await persistRefreshedLore("a1", "Stale doc", [], null, "deleted-job")).toBe(false);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("takes the artist lock, checks the claim and the job, then upserts content and citations", async () => {
    const sources = [{ id: 1, label: "PDF" }];
    expect(await persistRefreshedLore("a1", "New doc", sources, "current-claim", "j1")).toBe(true);
    expect(tx.execute.mock.invocationCallOrder[0]).toBeLessThan(
      tx.query.artistClaims.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.query.artistResearchJobs.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      values.mock.invocationCallOrder[0],
    );
    expect(values).toHaveBeenCalledWith({
      artistId: "a1",
      content: "New doc",
      sources,
      loreSummary: null,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ content: "New doc", sources }) }),
    );
  });

  it("skips the job check when no job is given", async () => {
    expect(await persistRefreshedLore("a1", "Doc", [], "current-claim")).toBe(true);
    expect(tx.query.artistResearchJobs.findFirst).not.toHaveBeenCalled();
  });

  it("keeps the last good summary when this attempt produced none", async () => {
    await persistRefreshedLore("a1", "Doc", [], "current-claim", "j1", undefined);
    expect(upsert.mock.calls[0][0].set).not.toHaveProperty("loreSummary");
  });

  it.each([null, { text: "New overview.", sourceKey: "k" }])(
    "applies an explicit clear or replacement: %j",
    async summary => {
      await persistRefreshedLore("a1", "Doc", [], "current-claim", "j1", summary);
      expect(upsert.mock.calls[0][0].set.loreSummary).toEqual(summary);
    },
  );
});

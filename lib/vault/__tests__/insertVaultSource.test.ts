import { describe, it, expect, vi, beforeEach } from "vitest";

const { values, execute, transaction, scoped, record } = vi.hoisted(() => ({
  values: vi.fn(),
  execute: vi.fn(async () => []),
  transaction: vi.fn(),
  scoped: vi.fn(),
  record: vi.fn(async () => "activity-new"),
}));
const writer = { insert: () => ({ values }), execute };
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: record }));
const { insertVaultSource } = await import("@/lib/vault/insertVaultSource");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");

const returning = vi.fn();
beforeEach(() => {
  returning.mockReset().mockResolvedValue([{ id: "s1", url: "https://example.com/a" }]);
  values.mockReset().mockReturnValue({ onConflictDoNothing: () => ({ returning }) });
  execute.mockClear();
  record.mockClear();
  transaction.mockReset().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(writer));
  scoped
    .mockReset()
    .mockImplementation(async (_a: string, fn: (tx: unknown) => unknown) => fn(writer));
});

describe("insertVaultSource", () => {
  it("persists the publication date, and null rather than undefined when there is none", async () => {
    await insertVaultSource({
      artistId: "a1",
      url: "https://voyagemia.com/x",
      publishedAt: "2019-01-10",
    });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ publishedAt: "2019-01-10" }));
    await insertVaultSource({ artistId: "a1", url: "https://soundbetter.com/x" });
    expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ publishedAt: null }));
  });

  it("stores one canonical URL", async () => {
    await insertVaultSource({ artistId: "a1", url: "HTTPS://EXAMPLE.COM:443/article#bio" });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/article",
        type: "article",
        status: "pending",
      }),
    );
  });

  it("inside a research operation: scoped write, research origin, the operation's activity, no new event", async () => {
    const source = await withArtistOperation(
      "a1",
      { expectedClaimId: "c", userId: "admin", activityId: "run-event", sourceOrigin: "research" },
      () => insertVaultSource({ artistId: "a1", url: "https://example.com/a" }),
    );
    expect(scoped).toHaveBeenCalledWith("a1", expect.any(Function));
    expect(transaction).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "research", activityId: "run-event" }),
    );
    expect(record).not.toHaveBeenCalled();
    expect(source).toEqual({ id: "s1", url: "https://example.com/a", activityId: "run-event" });
  });

  it("outside an operation: one transaction that records the addition and links it", async () => {
    const source = await insertVaultSource({ artistId: "a1", url: "https://example.com/a" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "unknown", activityId: null }),
    );
    expect(record).toHaveBeenCalledWith(
      "a1",
      "source_added",
      expect.objectContaining({ sourceId: "s1", trigger: "editor_source" }),
      writer,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(source).toMatchObject({ id: "s1", activityId: "activity-new" });
  });

  it("returns undefined when the row already existed, and records nothing", async () => {
    returning.mockResolvedValueOnce([]);
    expect(
      await insertVaultSource({ artistId: "a1", url: "https://example.com/a" }),
    ).toBeUndefined();
    expect(record).not.toHaveBeenCalled();
  });

  it("rethrows a failed write", async () => {
    transaction.mockImplementationOnce(async () => {
      throw new Error("source database unavailable");
    });
    await expect(
      insertVaultSource({ artistId: "a1", url: "https://example.com/a" }),
    ).rejects.toThrow("source database unavailable");
  });
});

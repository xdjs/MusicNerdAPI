import { sql, type SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { write, record, returning, set, where, queue } = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn((..._a: unknown[]) => ({ returning }));
  const set = vi.fn((..._a: unknown[]) => ({ where }));
  return { queue: vi.fn(), write: vi.fn(), record: vi.fn(), returning, set, where };
});
const tx = { update: vi.fn(() => ({ set })) };
vi.mock("@/lib/vault/withVaultSourceWrite", () => ({ withVaultSourceWrite: write }));
vi.mock("@/lib/sourceExtraction/queueApprovedSourceExtraction", () => ({
  queueApprovedSourceExtraction: queue,
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: record }));
const { updateVaultSourceStatus } = await import("@/lib/vault/updateVaultSourceStatus");

beforeEach(() => {
  write.mockReset().mockImplementation(async (_id, fn) => fn(tx, sql`true`));
  record.mockReset().mockResolvedValue("e1");
  returning.mockReset().mockResolvedValue([{ id: "s1", artistId: "a1" }]);
  queue.mockReset();
  set.mockClear();
  where.mockClear();
});

describe("updateVaultSourceStatus", () => {
  it("sets the status and records the decision as activity on the same transaction", async () => {
    expect(await updateVaultSourceStatus("s1", "approved")).toEqual({ id: "s1", artistId: "a1" });
    expect(write.mock.calls[0][0]).toBe("s1");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    expect(renderSql(where.mock.calls[0][0] as SQL).text).toContain('"status" <>');
    expect(renderSql(where.mock.calls[0][0] as SQL).params).toContain("approved");
    expect(record).toHaveBeenCalledWith("a1", "source_approved", { sourceId: "s1" }, tx);
    expect(queue).toHaveBeenCalledWith(tx, { id: "s1", artistId: "a1" }, "e1");
  });

  it("records nothing when no row matched", async () => {
    returning.mockResolvedValueOnce([]);
    expect(await updateVaultSourceStatus("s1", "rejected")).toBeUndefined();
    expect(record).not.toHaveBeenCalled();
  });

  it("rethrows a failed write", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    write.mockRejectedValueOnce(new Error("pool"));
    await expect(updateVaultSourceStatus("s1", "approved")).rejects.toThrow("pool");
    error.mockRestore();
  });
});

it("declines changed research snapshots before updating moderation", async () => {
  const source = {
    id: "s1",
    artistId: "a1",
    origin: "research",
    activityId: "e",
    status: "pending",
    publication: "inherit",
    url: "https://a.test",
    extractedText: "x".repeat(500),
    updatedAt: "old",
  };
  Object.assign(tx, {
    select: () => ({
      from: () => ({ where: () => ({ for: async () => [{ ...source, status: "rejected" }] }) }),
    }),
  });
  expect(await updateVaultSourceStatus("s1", "approved", source as never)).toBeUndefined();
  expect(set).not.toHaveBeenCalled();
});

it.each([
  { status: "rejected" },
  { publication: "private" },
  { extractedText: "edited" },
  { title: "edited" },
  { activityId: "other" },
  { origin: "submission" },
  { updatedAt: "later" },
  { status: "approved" },
])("preserves concurrent source changes %j", async change => {
  const source = {
    id: "s1",
    artistId: "a1",
    origin: "research",
    activityId: "e",
    status: "pending",
    publication: "inherit",
    url: "https://a.test",
    extractedText: "x".repeat(500),
    updatedAt: "old",
  };
  Object.assign(tx, {
    select: () => ({
      from: () => ({ where: () => ({ for: async () => [{ ...source, ...change }] }) }),
    }),
  });
  expect(await updateVaultSourceStatus("s1", "approved", source as never)).toBeUndefined();
  expect(set).not.toHaveBeenCalled();
  expect(record).not.toHaveBeenCalled();
});
it("approves unchanged readable research with activity on the same transaction", async () => {
  const source = {
    id: "s1",
    artistId: "a1",
    origin: "research",
    activityId: "e",
    status: "pending",
    publication: "inherit",
    url: "https://a.test",
    extractedText: "x".repeat(500),
    updatedAt: "old",
  };
  Object.assign(tx, {
    select: () => ({ from: () => ({ where: () => ({ for: async () => [source] }) }) }),
  });
  expect(await updateVaultSourceStatus("s1", "approved", source as never)).toBeDefined();
  expect(record).toHaveBeenCalled();
});

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

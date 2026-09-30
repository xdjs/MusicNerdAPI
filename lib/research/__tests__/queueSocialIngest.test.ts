import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { txExecute, lockScoped, lockRow, ownership, record } = vi.hoisted(() => ({
  txExecute: vi.fn(),
  lockScoped: vi.fn(),
  lockRow: vi.fn(),
  ownership: vi.fn(),
  record: vi.fn(),
}));
const tx = { execute: txExecute };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (t: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: lockScoped }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: lockRow }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: ownership,
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: record }));
const { queueSocialIngest } = await import("@/lib/research/queueSocialIngest");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  txExecute.mockReset().mockResolvedValue([]);
  lockScoped.mockReset();
  lockRow.mockReset();
  ownership.mockReset().mockReturnValue({ expectedClaimId: "c1", userId: "u1" });
  record.mockReset().mockResolvedValue("e1");
});

describe("queueSocialIngest", () => {
  it("queues a scrape under the scoped lock, attributed to a new activity", async () => {
    expect(await queueSocialIngest("a1", { force: true })).toBe(true);
    expect(lockScoped).toHaveBeenCalledWith(tx, "a1");
    expect(lockRow).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith("a1", "social_ingest", {}, tx);
    const insert = renderSql(txExecute.mock.calls[1][0]);
    expect(insert.text).toContain(
      "insert into artist_research_jobs (artist_id, kind, total, state, activity_id)",
    );
    expect(insert.text).toContain("on conflict do nothing");
    expect(insert.params).toEqual(["a1", "social_ingest", null, '{"force":true}', "e1"]);
  });

  it("takes the plain row lock outside an operation", async () => {
    ownership.mockReturnValueOnce(undefined);
    await queueSocialIngest("a1", {});
    expect(lockRow).toHaveBeenCalledWith(tx, "a1");
    expect(lockScoped).not.toHaveBeenCalled();
  });

  it("does not start a competing scrape while Update Latest is checking Instagram", async () => {
    txExecute.mockResolvedValueOnce([{ id: "latest" }]);
    expect(await queueSocialIngest("a1", { force: true })).toBe(false);
    const { text } = renderSql(txExecute.mock.calls[0][0]);
    expect(text).toContain("kind='latest_refresh'");
    expect(text).toContain("state->'sources'->'instagram'->>'status'='pending'");
    expect(record).not.toHaveBeenCalled();
  });

  it("rethrows a changed claim and reports other failures as false", async () => {
    lockScoped.mockRejectedValueOnce(new OwnershipChangedError());
    await expect(queueSocialIngest("a1", {})).rejects.toBeInstanceOf(OwnershipChangedError);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    lockScoped.mockRejectedValueOnce(new Error("pool"));
    expect(await queueSocialIngest("a1", {})).toBe(false);
    error.mockRestore();
  });
});

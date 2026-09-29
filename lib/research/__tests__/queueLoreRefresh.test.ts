import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { txExecute, lockArtistRow, findApprovedClaim, record } = vi.hoisted(() => ({
  txExecute: vi.fn(),
  lockArtistRow: vi.fn(),
  findApprovedClaim: vi.fn(),
  record: vi.fn(),
}));
const tx = { execute: txExecute };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (t: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: record }));
const { queueLoreRefresh } = await import("@/lib/research/queueLoreRefresh");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  txExecute.mockReset().mockResolvedValue([]);
  lockArtistRow.mockReset();
  findApprovedClaim.mockReset().mockResolvedValue({ id: "c1" });
  record.mockReset().mockResolvedValue("e1");
});

describe("queueLoreRefresh", () => {
  it("locks the artist, records the request and upserts the live lore_refresh", async () => {
    expect(await queueLoreRefresh("a1", "c1")).toBe(true);
    expect(lockArtistRow).toHaveBeenCalledWith(tx, "a1");
    expect(record).toHaveBeenCalledWith("a1", "lore_refresh", {}, tx);
    const { text, params } = renderSql(txExecute.mock.calls[0][0]);
    expect(text).toContain(
      "insert into artist_research_jobs (artist_id, kind, state, activity_id)",
    );
    expect(text).toContain(
      "on conflict (artist_id, kind) where status in ('pending', 'running') do update",
    );
    expect(text).toContain("'{requestedAt}', to_jsonb(clock_timestamp()::text)");
    expect(params).toContain(JSON.stringify({ claimId: "c1" }));
    expect(params).toContain("e1");
  });

  it("refuses when the claim changed", async () => {
    findApprovedClaim.mockResolvedValueOnce({ id: "c2" });
    await expect(queueLoreRefresh("a1", "c1")).rejects.toBeInstanceOf(OwnershipChangedError);
    expect(txExecute).not.toHaveBeenCalled();
  });

  it("a manual request does nothing when a refresh is live or ran in the last 30 minutes", async () => {
    txExecute.mockResolvedValueOnce([{ id: "j1" }]);
    expect(await queueLoreRefresh("a1", "c1", { manual: true })).toBe(false);
    const { text } = renderSql(txExecute.mock.calls[0][0]);
    expect(text).toContain("created_at > now() - interval '30 minutes'");
    expect(record).not.toHaveBeenCalled();
    expect(txExecute).toHaveBeenCalledTimes(1);
  });
});

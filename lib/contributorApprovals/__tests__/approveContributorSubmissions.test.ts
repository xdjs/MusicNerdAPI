import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ approve: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/contributorApprovals/approveContributorSubmission", () => ({
  approveContributorSubmission: m.approve,
}));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: m.refresh }));
const { approveContributorSubmissions } =
  await import("@/lib/contributorApprovals/approveContributorSubmissions");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("approveContributorSubmissions", () => {
  it("counts approved, skipped and failed items, once each", async () => {
    m.approve
      .mockResolvedValueOnce({ artistId: "a1", lore: false })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("conflict"));
    const result = await approveContributorSubmissions("admin", "u1", [
      { id: "g1", type: "link" },
      { id: "g1", type: "link" },
      { id: "g2", type: "link" },
      { id: "s1", type: "lore" },
    ]);
    expect(result).toEqual({ approved: 1, skipped: 1, failed: 1 });
    expect(m.approve).toHaveBeenCalledTimes(3);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("queues one Lore refresh per artist with an approved source", async () => {
    m.approve
      .mockResolvedValueOnce({ artistId: "a1", lore: true, claimId: "c1" })
      .mockResolvedValueOnce({ artistId: "a1", lore: true, claimId: "c1" });
    m.refresh.mockResolvedValue(true);
    const result = await approveContributorSubmissions("admin", "u1", [
      { id: "s1", type: "lore" },
      { id: "s2", type: "upload" },
    ]);
    expect(result).toEqual({ approved: 2, skipped: 0, failed: 0 });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(m.refresh).toHaveBeenCalledWith("a1", "c1", {
      userId: "admin",
      trigger: "admin_bulk_review",
    });
  });

  it("warns when a Lore refresh could not start", async () => {
    m.approve.mockResolvedValueOnce({ artistId: "a1", lore: true, claimId: null });
    m.refresh.mockRejectedValueOnce(new Error("ownership changed"));
    expect(
      await approveContributorSubmissions("admin", "u1", [{ id: "s1", type: "lore" }]),
    ).toEqual({
      approved: 1,
      skipped: 0,
      failed: 0,
      warning:
        "Approvals saved. Lore refresh could not start for 1 artist(s); use Look again on those profiles to retry.",
    });
  });
});

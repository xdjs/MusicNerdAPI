import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeTransaction } from "@/lib/artistLinkReview/__tests__/fakeTransaction";

const m = vi.hoisted(() => ({
  tx: null as unknown,
  activity: vi.fn(),
  approveUGC: vi.fn(),
  source: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: (cb: (tx: unknown) => unknown) => cb(m.tx) } }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
vi.mock("@/lib/artistLinkReview/approveUGC", () => ({ approveUGC: m.approveUGC }));
vi.mock("@/lib/contributorApprovals/approveContributorSource", () => ({
  approveContributorSource: m.source,
}));
const { approveContributorSubmission } =
  await import("@/lib/contributorApprovals/approveContributorSubmission");

beforeEach(() => vi.clearAllMocks());

describe("approveContributorSubmission", () => {
  it("approves a Lore source or upload through the source path", async () => {
    m.source.mockResolvedValueOnce({ artistId: "a1", lore: true, claimId: null });
    expect(await approveContributorSubmission("admin", "u1", { id: "s1", type: "upload" })).toEqual(
      {
        artistId: "a1",
        lore: true,
        claimId: null,
      },
    );
    expect(m.source).toHaveBeenCalledWith("admin", "s1", "u1");
  });

  it("approves the contributor's pending link and records it", async () => {
    const tx = fakeTransaction([
      [{ is_admin: true }],
      [{ id: "g1", artist_id: "a1", site_name: "instagram", site_username: "dutchyyy" }],
    ]);
    m.tx = tx;
    expect(await approveContributorSubmission("admin", "u1", { id: "g1", type: "link" })).toEqual({
      artistId: "a1",
      lore: false,
    });
    const [, link] = tx.statements();
    expect(link.text).toContain("from ugcresearch");
    expect(link.text).toContain("user_id = $2::uuid and origin = 'submission'");
    expect(link.text).toContain("for update");
    expect(link.params).toEqual(["g1", "u1"]);
    expect(m.approveUGC).toHaveBeenCalledWith("g1", "a1", "instagram", "dutchyyy", tx);
    expect(m.activity).toHaveBeenCalledWith(
      "a1",
      "link_approved",
      { userId: "admin", sourceId: "g1", trigger: "admin_bulk_review" },
      tx,
    );
  });

  it("skips a link that is no longer pending", async () => {
    m.tx = fakeTransaction([[{ is_admin: true }], []]);
    expect(
      await approveContributorSubmission("admin", "u1", { id: "g1", type: "link" }),
    ).toBeNull();
    expect(m.approveUGC).not.toHaveBeenCalled();
  });

  it("refuses a reviewer who is no longer an admin", async () => {
    m.tx = fakeTransaction([[]]);
    await expect(
      approveContributorSubmission("admin", "u1", { id: "g1", type: "link" }),
    ).rejects.toThrow("Admin access required.");
  });
});

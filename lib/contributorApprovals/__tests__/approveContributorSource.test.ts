import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeTransaction } from "@/lib/artistLinkReview/__tests__/fakeTransaction";

const m = vi.hoisted(() => ({
  tx: null as unknown,
  activity: vi.fn(),
  queue: vi.fn(),
  claim: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: (cb: (tx: unknown) => unknown) => cb(m.tx) } }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
vi.mock("@/lib/sourceExtraction/queueApprovedSourceExtraction", () => ({
  queueApprovedSourceExtraction: m.queue,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
const { approveContributorSource } =
  await import("@/lib/contributorApprovals/approveContributorSource");

const source = {
  id: "s1",
  url: "https://example.com/a",
  status: "approved",
  file_path: null,
  extracted_text: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.activity.mockResolvedValue("act-1");
  m.claim.mockResolvedValue({ id: "claim-1" });
});

describe("approveContributorSource", () => {
  it("approves the contributor's pending source, records it and queues extraction", async () => {
    const tx = fakeTransaction([[{ is_admin: true }], [{ artist_id: "a1" }], [], [source]]);
    m.tx = tx;
    expect(await approveContributorSource("admin", "s1", "u1")).toEqual({
      artistId: "a1",
      lore: true,
      claimId: "claim-1",
    });
    const [admin, candidate, lock, update] = tx.statements();
    expect(admin.text).toContain("select is_admin from users where id = $1::uuid for share");
    expect(candidate.params).toEqual(["s1"]);
    expect(lock.text).toContain("from artists where id = $1::uuid for update");
    expect(update.text).toContain("set status = 'approved'");
    expect(update.text).toContain("and s.status = 'pending'");
    expect(update.text).toContain("s.origin in ('submission', 'upload')");
    expect(update.text).toContain("e.actor_user_id = $");
    expect(update.params).toEqual(["s1", "a1", "u1"]);
    expect(m.activity).toHaveBeenCalledWith(
      "a1",
      "source_approved",
      { userId: "admin", sourceId: "s1", trigger: "admin_bulk_review" },
      tx,
    );
    expect(m.queue).toHaveBeenCalledWith(
      tx,
      {
        id: "s1",
        artistId: "a1",
        url: source.url,
        status: "approved",
        filePath: null,
        extractedText: null,
      },
      "act-1",
    );
  });

  it("refuses a reviewer who is no longer an admin", async () => {
    m.tx = fakeTransaction([[{ is_admin: false }]]);
    await expect(approveContributorSource("admin", "s1", "u1")).rejects.toThrow(
      "Admin access required.",
    );
  });

  it("skips a source that is gone", async () => {
    m.tx = fakeTransaction([[{ is_admin: true }], []]);
    expect(await approveContributorSource("admin", "s1", "u1")).toBeNull();
  });

  it("skips a source that is no longer pending or not this contributor's", async () => {
    m.tx = fakeTransaction([[{ is_admin: true }], [{ artist_id: "a1" }], [], []]);
    expect(await approveContributorSource("admin", "s1", "u1")).toBeNull();
    expect(m.activity).not.toHaveBeenCalled();
  });
});

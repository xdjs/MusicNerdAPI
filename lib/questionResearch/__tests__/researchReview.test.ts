import { it, expect, vi, beforeEach } from "vitest";
import { reviewResearchDiscovery } from "@/lib/questionResearch/reviewResearchDiscovery";
const m = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  auth: vi.fn(),
  activity: vi.fn(),
  claim: vi.fn(),
  writeLink: vi.fn(),
  identityLock: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction, execute: m.execute } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: m.lock }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({ authorizeArtistKnowledge: m.auth }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/artistLinks/writeArtistLinkColumn", () => ({ writeArtistLinkColumn: m.writeLink }));
vi.mock("@/lib/artistLinks/acquireArtistPlatformWriteLocks", () => ({
  acquireArtistPlatformWriteLocks: m.identityLock,
}));
const rev = "a".repeat(64),
  candidate = {
    id: "candidate",
    url: "https://artist.example/story",
    destination: "lore",
    identity: "confirmed",
    curation: "pending",
    reason: "reporting",
    platform: null,
    platform_id: null,
    source_id: null,
    reviewed_revision: null,
  };
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
  m.activity.mockResolvedValue("event");
  m.claim.mockResolvedValue(null);
});
it("requires the reviewed revision to still be the current original", async () => {
  m.execute
    .mockResolvedValueOnce([candidate])
    .mockResolvedValueOnce([candidate])
    .mockResolvedValueOnce([{ revision: "b".repeat(64) }]);
  await expect(
    reviewResearchDiscovery("artist", "user", "candidate", rev, "approve"),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.activity).not.toHaveBeenCalled();
  expect(m.writeLink).not.toHaveBeenCalled();
});
it("keeps a decline separate from a wrong-artist decision and does not promote content", async () => {
  m.execute
    .mockResolvedValueOnce([candidate])
    .mockResolvedValueOnce([candidate])
    .mockResolvedValueOnce([
      {
        id: "evidence",
        revision: rev,
        title: "Original",
        original_text: "Original passage",
        provenance: { kind: "original_text" },
      },
    ])
    .mockResolvedValueOnce([{ ...candidate, curation: "declined", reviewed_revision: rev }]);
  const result = await reviewResearchDiscovery("artist", "user", "candidate", rev, "decline");
  expect(result.candidate.curation).toBe("declined");
  expect(m.writeLink).not.toHaveBeenCalled();
  expect(m.activity).toHaveBeenCalledWith(
    "artist",
    "research_discovery_decline",
    expect.objectContaining({ userId: "user" }),
    expect.anything(),
  );
});
it("rechecks current authorization before promotion", async () => {
  m.execute.mockResolvedValueOnce([candidate]);
  m.auth.mockRejectedValue(new Error("claim changed"));
  await expect(
    reviewResearchDiscovery("artist", "user", "candidate", rev, "approve"),
  ).rejects.toThrow("claim changed");
  expect(m.activity).not.toHaveBeenCalled();
});

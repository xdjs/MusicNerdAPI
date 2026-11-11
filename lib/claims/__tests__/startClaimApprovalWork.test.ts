import { describe, it, expect, vi, beforeEach } from "vitest";
import { startClaimApprovalWork } from "@/lib/claims/startClaimApprovalWork";

const m = vi.hoisted(() => ({
  reuse: vi.fn(),
  search: vi.fn(),
  interview: vi.fn(),
  state: vi.fn(),
  build: vi.fn(),
  op: vi.fn(),
}));
vi.mock("@/lib/directoryPreparation/hasReusableDirectoryDiscovery", () => ({
  hasReusableDirectoryDiscovery: m.reuse,
}));
vi.mock("@/lib/claims/queueClaimSourceSearch", () => ({ queueClaimSourceSearch: m.search }));
vi.mock("@/lib/claims/queueClaimInterview", () => ({ queueClaimInterview: m.interview }));
vi.mock("@/lib/onboarding/getOnboardingState", () => ({ getOnboardingState: m.state }));
vi.mock("@/lib/claimBuild/startClaimBuild", () => ({ startClaimBuild: m.build }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({
  withArtistOperation: (artistId: string, ownership: unknown, fn: () => unknown) => {
    m.op(artistId, ownership);
    return fn();
  },
}));

const claim = { id: "c1", artistId: "a1", userId: "claimant" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.reuse.mockResolvedValue(false);
  m.search.mockResolvedValue(true);
  m.interview.mockResolvedValue(true);
  m.state.mockResolvedValue({ complete: false });
  m.build.mockResolvedValue("wrun_1");
});

describe("startClaimApprovalWork", () => {
  it("queues research and interview preparation as the admin, and builds as the claimant", async () => {
    expect(await startClaimApprovalWork(claim, "admin")).toBeUndefined();
    expect(m.op).toHaveBeenCalledWith("a1", {
      userId: "admin",
      expectedClaimId: "c1",
      trigger: "claim_approval",
    });
    expect(m.search).toHaveBeenCalledWith("a1", "c1");
    expect(m.interview).toHaveBeenCalledWith("a1", "c1", "claimant");
    expect(m.build).toHaveBeenCalledWith("a1", { userId: "claimant", expectedClaimId: "c1" });
  });

  it("reuses completed directory discovery instead of searching again", async () => {
    m.reuse.mockResolvedValueOnce(true);
    expect(await startClaimApprovalWork(claim, "admin")).toBeUndefined();
    expect(m.search).not.toHaveBeenCalled();
  });

  it("starts no build for a page that's already built", async () => {
    m.state.mockResolvedValueOnce({ complete: true });
    expect(await startClaimApprovalWork(claim, "admin")).toBeUndefined();
    expect(m.build).not.toHaveBeenCalled();
  });

  it("warns about research first, whatever else failed", async () => {
    m.search.mockRejectedValueOnce(new Error("x"));
    m.interview.mockResolvedValueOnce(false);
    m.build.mockRejectedValueOnce(new Error("x"));
    expect(await startClaimApprovalWork(claim, "admin")).toBe(
      "Claim approved, but source research could not be queued. Open the artist’s Lore and use “Search web for sources” to retry.",
    );
  });

  it("then about interview preparation, then the build", async () => {
    m.interview.mockRejectedValueOnce(new Error("x"));
    m.build.mockRejectedValueOnce(new Error("x"));
    expect(await startClaimApprovalWork(claim, "admin")).toBe(
      "Claim approved, but interview preparation could not be queued. The artist can still prepare an interview from their profile.",
    );
    m.build.mockRejectedValueOnce(new Error("x"));
    expect(await startClaimApprovalWork(claim, "admin")).toBe(
      "Claim approved, but the page build could not start. It restarts when the artist taps “Try again” on their page.",
    );
  });
});

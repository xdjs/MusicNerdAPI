import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ profiles: vi.fn(), drain: vi.fn() }));
vi.mock("@/lib/onboarding/autoBuildProfiles", () => ({ autoBuildProfiles: m.profiles }));
vi.mock("@/lib/claimBuild/drainBuildStage", () => ({ drainBuildStage: m.drain }));
const { buildClaimProfiles } = await import("@/lib/claimBuild/buildClaimProfiles");

describe("buildClaimProfiles", () => {
  it("runs stage 1 under the claim and keeps only the guessed columns", async () => {
    const stage = {};
    m.profiles.mockReturnValueOnce(stage);
    m.drain.mockResolvedValueOnce({
      provisionalSiteNames: ["bandcamp"],
      discoveredBySiteName: new Map([["bandcamp", {}]]),
    });
    const ownership = { userId: "u1", expectedClaimId: "c1" };
    await expect(buildClaimProfiles("a1", ownership)).resolves.toEqual(["bandcamp"]);
    expect(m.profiles).toHaveBeenCalledWith("a1");
    expect(m.drain).toHaveBeenCalledWith("a1", ownership, stage);
  });
});

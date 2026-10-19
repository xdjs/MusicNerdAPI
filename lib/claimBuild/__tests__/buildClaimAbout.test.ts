import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ about: vi.fn(), drain: vi.fn() }));
vi.mock("@/lib/onboarding/autoBuildAbout", () => ({ autoBuildAbout: m.about }));
vi.mock("@/lib/claimBuild/drainBuildStage", () => ({ drainBuildStage: m.drain }));
const { buildClaimAbout } = await import("@/lib/claimBuild/buildClaimAbout");

describe("buildClaimAbout", () => {
  it("runs stage 3 under the claim, which publishes the About", async () => {
    const stage = {};
    m.about.mockReturnValueOnce(stage);
    m.drain.mockResolvedValueOnce(undefined);
    const ownership = { userId: "u1", expectedClaimId: "c1" };
    await expect(buildClaimAbout("a1", ownership)).resolves.toBeUndefined();
    expect(m.about).toHaveBeenCalledWith("a1", ownership, 0);
    expect(m.drain).toHaveBeenCalledWith("a1", ownership, stage);
  });
});

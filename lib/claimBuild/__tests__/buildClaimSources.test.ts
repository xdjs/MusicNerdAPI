import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ sources: vi.fn(), drain: vi.fn() }));
vi.mock("@/lib/onboarding/autoBuildSources", () => ({ autoBuildSources: m.sources }));
vi.mock("@/lib/claimBuild/drainBuildStage", () => ({ drainBuildStage: m.drain }));
const { buildClaimSources } = await import("@/lib/claimBuild/buildClaimSources");

describe("buildClaimSources", () => {
  it("runs stage 2 under the claim with stage 1's guesses and no account choices", async () => {
    const stage = {};
    m.sources.mockReturnValueOnce(stage);
    m.drain.mockResolvedValueOnce({ citable: 3 });
    const ownership = { userId: "u1", expectedClaimId: "c1" };
    await expect(buildClaimSources("a1", ownership, ["bandcamp"])).resolves.toBeUndefined();
    expect(m.sources).toHaveBeenCalledWith("a1", ["bandcamp"], new Map());
    expect(m.drain).toHaveBeenCalledWith("a1", ownership, stage);
  });
});

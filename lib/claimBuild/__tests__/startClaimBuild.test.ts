import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("workflow/api", () => ({ start: m.start }));
vi.mock("@/lib/claimBuild/claimBuildWorkflow", () => ({ claimBuildWorkflow: "workflow-ref" }));
const { startClaimBuild } = await import("@/lib/claimBuild/startClaimBuild");

describe("startClaimBuild", () => {
  it("starts the workflow for the artist under the claim and returns its run id", async () => {
    m.start.mockResolvedValueOnce({ runId: "wrun_1" });
    const ownership = { userId: "u1", expectedClaimId: "c1" };
    await expect(startClaimBuild("a1", ownership)).resolves.toBe("wrun_1");
    expect(m.start).toHaveBeenCalledWith("workflow-ref", ["a1", ownership]);
  });
});

import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ state: vi.fn() }));
vi.mock("@/lib/onboarding/getOnboardingState", () => ({ getOnboardingState: m.state }));
const { readClaimBuildStep } = await import("@/lib/claimBuild/readClaimBuildStep");

describe("readClaimBuildStep", () => {
  it("is the first unconfirmed step", async () => {
    m.state.mockResolvedValueOnce({ complete: false, currentStep: "vault" });
    await expect(readClaimBuildStep("a1")).resolves.toBe("vault");
  });

  it("is null once the page is built", async () => {
    m.state.mockResolvedValueOnce({ complete: true, currentStep: null });
    await expect(readClaimBuildStep("a1")).resolves.toBeNull();
  });

  it("throws when the state can't be read, so the step retries", async () => {
    m.state.mockResolvedValueOnce(null);
    await expect(readClaimBuildStep("a1")).rejects.toThrow("Onboarding state unavailable");
  });
});

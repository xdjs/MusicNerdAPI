import { describe, it, expect, vi, beforeEach } from "vitest";

const { getConfirmedSteps } = vi.hoisted(() => ({ getConfirmedSteps: vi.fn() }));
vi.mock("@/lib/onboarding/getConfirmedSteps", () => ({ getConfirmedSteps }));
const { getOnboardingState } = await import("@/lib/onboarding/getOnboardingState");

beforeEach(() => getConfirmedSteps.mockReset());

describe("getOnboardingState", () => {
  it("is complete only when publish is confirmed", async () => {
    getConfirmedSteps.mockResolvedValueOnce(new Set(["profiles", "vault", "interview", "publish"]));
    expect(await getOnboardingState("a1")).toEqual({ complete: true, currentStep: null });
  });

  it("derives the current step from confirmations", async () => {
    getConfirmedSteps.mockResolvedValueOnce(new Set(["profiles"]));
    expect(await getOnboardingState("a1")).toEqual({ complete: false, currentStep: "vault" });
  });

  it("is null (unknown) when the confirmations can't be read", async () => {
    getConfirmedSteps.mockResolvedValueOnce(null);
    expect(await getOnboardingState("a1")).toBeNull();
  });
});

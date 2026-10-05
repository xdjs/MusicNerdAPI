import { describe, it, expect, vi, beforeEach } from "vitest";

const { getOnboardingStepTimes } = vi.hoisted(() => ({ getOnboardingStepTimes: vi.fn() }));
vi.mock("@/lib/onboarding/getOnboardingStepTimes", () => ({ getOnboardingStepTimes }));
const { getConfirmedSteps } = await import("@/lib/onboarding/getConfirmedSteps");

const none = { profiles: null, vault: null, interview: null, publish: null };

beforeEach(() => getOnboardingStepTimes.mockReset());

describe("getConfirmedSteps", () => {
  it("returns the steps that have a confirmation time", async () => {
    getOnboardingStepTimes.mockResolvedValueOnce({
      ...none,
      profiles: "2026-10-02T23:33:42.122Z",
      vault: "2026-10-02T23:33:46.437Z",
    });
    expect(await getConfirmedSteps("a1")).toEqual(new Set(["profiles", "vault"]));
  });

  it("returns an empty set for a new claimant with nothing confirmed", async () => {
    getOnboardingStepTimes.mockResolvedValueOnce(none);
    expect(await getConfirmedSteps("a1")).toEqual(new Set());
  });

  it("returns null (unknown, not empty) when the read fails", async () => {
    getOnboardingStepTimes.mockResolvedValueOnce(null);
    expect(await getConfirmedSteps("a1")).toBeNull();
  });
});

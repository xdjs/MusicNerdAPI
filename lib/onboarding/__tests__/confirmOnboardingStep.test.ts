import { describe, it, expect, vi, beforeEach } from "vitest";

const { scoped, values, onConflictDoNothing } = vi.hoisted(() => ({
  scoped: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
const { confirmOnboardingStep } = await import("@/lib/onboarding/confirmOnboardingStep");

beforeEach(() => {
  onConflictDoNothing.mockReset().mockResolvedValue(undefined);
  values.mockReset().mockReturnValue({ onConflictDoNothing });
  scoped.mockReset().mockImplementation(async (_a, write) => write({ insert: () => ({ values }) }));
});

describe("confirmOnboardingStep", () => {
  it("inserts the confirmation idempotently, under the scoped write", async () => {
    await confirmOnboardingStep("a1", "profiles");
    expect(scoped.mock.calls[0][0]).toBe("a1");
    expect(values).toHaveBeenCalledWith({ artistId: "a1", step: "profiles" });
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(onConflictDoNothing.mock.calls[0][0].target).toHaveLength(2);
  });
});

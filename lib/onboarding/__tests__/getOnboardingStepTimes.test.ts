import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artistOnboardingSteps: { findMany } } } }));
const { getOnboardingStepTimes } = await import("@/lib/onboarding/getOnboardingStepTimes");

beforeEach(() => findMany.mockReset());

describe("getOnboardingStepTimes", () => {
  it("gives each confirmed step its time in ISO 8601 UTC, and null for the rest", async () => {
    findMany.mockResolvedValueOnce([
      { step: "profiles", confirmedAt: "2026-10-02 23:33:42.122269+00" },
      { step: "vault", confirmedAt: "2026-10-02 23:33:46.437169+00" },
    ]);
    expect(await getOnboardingStepTimes("a1")).toEqual({
      profiles: "2026-10-02T23:33:42.122Z",
      vault: "2026-10-02T23:33:46.437Z",
      interview: null,
      publish: null,
    });
  });

  it("gives every step null for an artist with nothing confirmed", async () => {
    findMany.mockResolvedValueOnce([]);
    expect(await getOnboardingStepTimes("a1")).toEqual({
      profiles: null,
      vault: null,
      interview: null,
      publish: null,
    });
  });

  it("ignores rows for steps that aren't onboarding steps", async () => {
    findMany.mockResolvedValueOnce([{ step: "legacy", confirmedAt: "2026-10-02 23:33:42+00" }]);
    expect(await getOnboardingStepTimes("a1")).toEqual({
      profiles: null,
      vault: null,
      interview: null,
      publish: null,
    });
  });

  it("returns null (unknown, not empty) when the read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    expect(await getOnboardingStepTimes("a1")).toBeNull();
    error.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artistOnboardingSteps: { findMany } } } }));
const { getConfirmedSteps } = await import("@/lib/onboarding/getConfirmedSteps");

beforeEach(() => findMany.mockReset());

describe("getConfirmedSteps", () => {
  it("returns the confirmed steps", async () => {
    findMany.mockResolvedValueOnce([{ step: "profiles" }, { step: "vault" }]);
    expect(await getConfirmedSteps("a1")).toEqual(new Set(["profiles", "vault"]));
  });

  it("returns an empty set for a new claimant with nothing confirmed", async () => {
    findMany.mockResolvedValueOnce([]);
    expect(await getConfirmedSteps("a1")).toEqual(new Set());
  });

  it("returns null (unknown, not empty) when the read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    expect(await getConfirmedSteps("a1")).toBeNull();
    error.mockRestore();
  });
});

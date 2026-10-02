import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS } from "@/lib/onboarding/const";
import { firstUnconfirmedStep } from "@/lib/onboarding/firstUnconfirmedStep";

describe("firstUnconfirmedStep", () => {
  it("returns profiles for an empty set", () => {
    expect(firstUnconfirmedStep(new Set())).toBe("profiles");
  });
  it("returns the first gap even when later steps are confirmed", () => {
    expect(firstUnconfirmedStep(new Set(["profiles", "interview"]))).toBe("vault");
  });
  it("returns publish when only publish remains", () => {
    expect(firstUnconfirmedStep(new Set(["profiles", "vault", "interview"]))).toBe("publish");
  });
  it("returns null when every step is confirmed", () => {
    expect(firstUnconfirmedStep(new Set(ONBOARDING_STEPS))).toBeNull();
  });
  it("ignores unknown values in the set", () => {
    expect(firstUnconfirmedStep(new Set(["bogus"]))).toBe("profiles");
  });
});

import { describe, it, expect } from "vitest";
import { containsMemoryOrApologyLanguage } from "@/lib/onboarding/containsMemoryOrApologyLanguage";

describe("containsMemoryOrApologyLanguage", () => {
  it("catches memory and apology phrases, any case", () => {
    expect(containsMemoryOrApologyLanguage("I must have MISREMEMBERED that.")).toBe(true);
    expect(containsMemoryOrApologyLanguage("Sorry about that!")).toBe(true);
    expect(containsMemoryOrApologyLanguage("I thought you'd say that.")).toBe(true);
  });

  it("passes a warm, specific reply", () => {
    expect(containsMemoryOrApologyLanguage("Love that the empanadas made it in.")).toBe(false);
  });
});

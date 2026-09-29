import { describe, it, expect } from "vitest";
import { buildRoutedToVaultPendingMessage } from "@/lib/onboarding/buildRoutedToVaultPendingMessage";

describe("buildRoutedToVaultPendingMessage", () => {
  it("adds them as possible sources without claiming they're the artist's", () => {
    expect(buildRoutedToVaultPendingMessage(["https://a.com", "https://b.com"])).toBe(
      "Those aren't platform profiles: https://a.com, https://b.com — I've added them as possible sources for your About; you'll get to confirm they're accurate in a moment.",
    );
    expect(buildRoutedToVaultPendingMessage(["https://a.com"])).toBe(
      "That's not a platform profile: https://a.com — I've added it as a possible source for your About; you'll get to confirm it's accurate in a moment.",
    );
  });
});

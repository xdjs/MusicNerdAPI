import { describe, it, expect } from "vitest";
import { buildRoutedToVaultOwnedMessage } from "@/lib/onboarding/buildRoutedToVaultOwnedMessage";

describe("buildRoutedToVaultOwnedMessage", () => {
  it("says the page looks like their site, singular and plural", () => {
    expect(buildRoutedToVaultOwnedMessage(["https://pete.com"])).toBe(
      "That's not a platform profile: https://pete.com — but it looks like your site, so I've added it as a source for your About.",
    );
    expect(buildRoutedToVaultOwnedMessage(["https://a.com", "https://b.com"])).toBe(
      "Those aren't platform profiles: https://a.com, https://b.com — but they look like your own sites, so I've added them as sources for your About.",
    );
  });
});

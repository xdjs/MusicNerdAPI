import { describe, it, expect } from "vitest";
import { buildWriteRejectedLinksMessage } from "@/lib/onboarding/buildWriteRejectedLinksMessage";

describe("buildWriteRejectedLinksMessage", () => {
  it("buildWriteRejectedLinksMessage says it's already linked elsewhere, without 'recognize'", () => {
    const blocked = buildWriteRejectedLinksMessage(["https://x.com/p"], true);
    expect(blocked).toBe(
      "Heads up — I couldn't save one of your links: https://x.com/p. Looks like it's already linked to another profile on Music Nerd — try a different link, or reach out if that seems wrong.",
    );
    expect(blocked).not.toMatch(/recognize/);
    expect(buildWriteRejectedLinksMessage(["https://a", "https://b"], false)).toBe(
      "Heads up — I couldn't save 2 of your links: https://a, https://b. Looks like they're already linked to another profile on Music Nerd — you can try again anytime from the Links section of your page, or reach out if that seems wrong.",
    );
  });
});

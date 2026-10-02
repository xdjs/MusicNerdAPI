import { describe, it, expect } from "vitest";
import { buildUnrecognizedLinksMessage } from "@/lib/onboarding/buildUnrecognizedLinksMessage";

describe("buildUnrecognizedLinksMessage", () => {
  it("buildUnrecognizedLinksMessage names the link and invites a paste only when blocked", () => {
    expect(buildUnrecognizedLinksMessage(["https://instagram.com"], true)).toBe(
      "Heads up — I couldn't recognize one of your links: https://instagram.com. It doesn't look like a direct profile link (no username or handle at the end) — paste the profile URL and I'll try again.",
    );
    expect(buildUnrecognizedLinksMessage(["https://a.com", "https://b.com"], false)).toBe(
      "Heads up — I couldn't recognize 2 of your links: https://a.com, https://b.com. They don't look like direct profile links (no username or handle at the end) — if it's on a platform we support, you can add them anytime from the Links section of your page.",
    );
  });
});

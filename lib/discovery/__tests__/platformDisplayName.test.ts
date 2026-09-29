import { describe, it, expect } from "vitest";
import { platformDisplayName } from "@/lib/discovery/platformDisplayName";

describe("platformDisplayName", () => {
  it("uses urlmap's card name, else the capitalized column", () => {
    const rows = new Map([["x", { cardPlatformName: "X (Twitter)" }]]);
    expect(platformDisplayName("x", rows)).toBe("X (Twitter)");
    expect(platformDisplayName("twitch", rows)).toBe("Twitch");
  });
});

import { describe, it, expect } from "vitest";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";

describe("platformEvent", () => {
  it("names the platform for the progress chip", () => {
    expect(platformEvent("searching", "instagram", URLMAP_BY_SITE)).toEqual({
      kind: "searching",
      platform: "instagram",
      displayName: "Instagram",
    });
    expect(platformEvent("unreachable", "twitch", URLMAP_BY_SITE)).toEqual({
      kind: "unreachable",
      platform: "twitch",
      displayName: "Twitch",
    });
  });
});

import { describe, it, expect } from "vitest";
import { buildLinkPresentationMeta } from "@/lib/links/buildLinkPresentationMeta";

describe("buildLinkPresentationMeta", () => {
  it("builds display name, logo, color and profile URL from the urlmap row", () => {
    expect(
      buildLinkPresentationMeta(
        {
          cardPlatformName: "Instagram",
          siteImage: "https://cdn/ig.png",
          colorHex: " #E1306C ",
          appStringFormat: "https://instagram.com/%@",
        },
        "instagram",
        "pete",
      ),
    ).toEqual({
      displayName: "Instagram",
      logoUrl: "https://cdn/ig.png",
      colorHex: "#E1306C",
      profileUrl: "https://instagram.com/pete",
    });
  });

  it("treats the #000000 placeholder as no color", () => {
    expect(buildLinkPresentationMeta({ colorHex: "#000000" }, "tiktok", "p").colorHex).toBeNull();
  });

  it("falls back to the capitalized column with no row", () => {
    expect(buildLinkPresentationMeta(undefined, "twitch", "p")).toEqual({
      displayName: "Twitch",
      logoUrl: null,
      colorHex: null,
      profileUrl: null,
    });
  });
});

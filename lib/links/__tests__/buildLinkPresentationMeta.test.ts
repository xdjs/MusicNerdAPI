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

  it("uses the canonical Deezer artist URL instead of the urlmap placeholder", () => {
    expect(
      buildLinkPresentationMeta({ appStringFormat: "deezer" }, "deezer", "65660322").profileUrl,
    ).toBe("https://www.deezer.com/artist/65660322");
  });

  it("shows a stored channel as YouTube with its canonical channel URL", () => {
    expect(buildLinkPresentationMeta(undefined, "youtubechannel", "UCexample")).toMatchObject({
      displayName: "YouTube",
      profileUrl: "https://www.youtube.com/channel/UCexample",
    });
    expect(
      buildLinkPresentationMeta(
        { appStringFormat: "https://youtube.com/@%@" },
        "youtubechannel",
        "UCexample",
      ).profileUrl,
    ).toBe("https://www.youtube.com/channel/UCexample");
  });

  it.each(["instagram", "javascript:alert(1)", "data:text/html,example"])(
    "does not turn the invalid template %s into a link",
    appStringFormat => {
      expect(
        buildLinkPresentationMeta({ appStringFormat }, "instagram", "nova").profileUrl,
      ).toBeNull();
    },
  );

  it("falls back to the capitalized column with no row", () => {
    expect(buildLinkPresentationMeta(undefined, "twitch", "p")).toEqual({
      displayName: "Twitch",
      logoUrl: null,
      colorHex: null,
      profileUrl: null,
    });
  });
});

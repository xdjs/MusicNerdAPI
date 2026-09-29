import { describe, it, expect } from "vitest";
import { buildTierFourQuery } from "@/lib/discovery/buildTierFourQuery";

describe("buildTierFourQuery", () => {
  it("adds the first genre when known, then 'music artist'", () => {
    expect(buildTierFourQuery("Pete Rango", null)).toBe("Pete Rango music artist");
    expect(
      buildTierFourQuery("Pete Rango", {
        platform: "spotify",
        platformId: "a",
        name: "Pete Rango",
        imageUrl: null,
        followerCount: 1,
        albumCount: 1,
        genres: ["neo soul", "rnb"],
        profileUrl: "u",
        topTrackName: null,
      }),
    ).toBe("Pete Rango neo soul music artist");
  });
});

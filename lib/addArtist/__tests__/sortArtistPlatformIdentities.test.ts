import { describe, it, expect } from "vitest";
import { sortArtistPlatformIdentities } from "@/lib/addArtist/sortArtistPlatformIdentities";

describe("sortArtistPlatformIdentities", () => {
  it("orders by platform then id, so locks are always taken in one order", () => {
    const s = { platform: "spotify" as const, platformId: "a" };
    const d2 = { platform: "deezer" as const, platformId: "2" };
    const d1 = { platform: "deezer" as const, platformId: "1" };
    expect(sortArtistPlatformIdentities([s, d2, d1])).toEqual([d1, d2, s]);
  });
});

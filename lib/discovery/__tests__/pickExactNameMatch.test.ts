import { describe, it, expect } from "vitest";
import { pickExactNameMatch } from "@/lib/discovery/pickExactNameMatch";

const artist = (name: string, followerCount: number | null, platformId = name) => ({
  platform: "spotify" as const,
  platformId,
  name,
  imageUrl: null,
  followerCount,
  albumCount: 0,
  genres: [],
  profileUrl: `https://open.spotify.com/artist/${platformId}`,
  topTrackName: null,
});

describe("pickExactNameMatch", () => {
  it("picks the exact case-insensitive match with the most followers", () => {
    const a = artist("pete rango", 10, "a");
    const b = artist("Pete Rango", 50, "b");
    expect(pickExactNameMatch([artist("Pete Rangoon", 999), a, b], "Pete  Rango")).toBe(b);
  });

  it("rejects a different name and a tie at the top", () => {
    expect(pickExactNameMatch([artist("Peter Rango", 5)], "Pete Rango")).toBeNull();
    expect(
      pickExactNameMatch(
        [artist("Pete Rango", 5, "a"), artist("Pete Rango", 5, "b")],
        "Pete Rango",
      ),
    ).toBeNull();
  });
});

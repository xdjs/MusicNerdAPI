import { describe, it, expect } from "vitest";
import { byAuthority } from "@/lib/sources/byAuthority";

describe("byAuthority", () => {
  it("orders a real vault best-first and keeps ties stable", () => {
    const vault = [
      { url: "https://clubhousedb.com/user/peterango", type: "profile" },
      { url: "https://open.spotify.com/playlist/abc", type: "audio" },
      { url: "https://voyagemia.com/interview/meet-peter-rango", type: "interview" },
      { url: "https://www.discogs.com/release/1-Nia-Sultana", type: "profile" },
      { url: "https://lifechangesnetwork.com/music-producer-pete-rango", type: "interview" },
    ];
    expect(
      byAuthority(vault, s => s).map(s => new URL(s.url).hostname.split(".").slice(-2)[0]),
    ).toEqual(["voyagemia", "lifechangesnetwork", "discogs", "spotify", "clubhousedb"]);
  });

  it("never drops anything", () => {
    const vault = [{ url: "https://clubhousedb.com/user/x", type: "profile" }];
    expect(byAuthority(vault, s => s)).toHaveLength(1);
  });
});

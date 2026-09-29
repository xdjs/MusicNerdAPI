import { describe, it, expect } from "vitest";
import { matchesHost } from "@/lib/sources/matchesHost";

describe("matchesHost", () => {
  it("matches a registrable domain and its subdomains, not look-alikes", () => {
    expect(matchesHost("m.boomplay.com", "https://m.boomplay.com/a", ["boomplay.com"])).toBe(true);
    expect(
      matchesHost("boomplay.com.evil.example", "https://boomplay.com.evil.example/x", [
        "boomplay.com",
      ]),
    ).toBe(false);
    expect(matchesHost("notboomplay.com", "https://notboomplay.com/x", ["boomplay.com"])).toBe(
      false,
    );
  });

  it("matches an entry with a path as a substring of the URL", () => {
    expect(matchesHost("last.fm", "https://last.fm/user/someone", ["last.fm/user"])).toBe(true);
    expect(matchesHost("last.fm", "https://last.fm/music/x", ["last.fm/user"])).toBe(false);
  });
});

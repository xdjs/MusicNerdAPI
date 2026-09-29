import { describe, it, expect } from "vitest";
import { rewriteTwitterHost } from "@/lib/artists/rewriteTwitterHost";

describe("rewriteTwitterHost", () => {
  it("rewrites twitter.com and its www/mobile/m hosts to x.com, keeping any scheme", () => {
    expect(rewriteTwitterHost("https://twitter.com/a")).toBe("https://x.com/a");
    expect(rewriteTwitterHost("http://www.twitter.com/a")).toBe("http://x.com/a");
    expect(rewriteTwitterHost("m.twitter.com/a")).toBe("x.com/a");
    expect(rewriteTwitterHost("https://twitter.com")).toBe("https://x.com");
  });

  it("leaves other hosts alone", () => {
    expect(rewriteTwitterHost("https://twitter.company.com/a")).toBe(
      "https://twitter.company.com/a",
    );
    expect(rewriteTwitterHost("https://nottwitter.com/a")).toBe("https://nottwitter.com/a");
  });
});

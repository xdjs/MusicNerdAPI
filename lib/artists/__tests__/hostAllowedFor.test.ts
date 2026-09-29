import { describe, it, expect } from "vitest";
import { hostAllowedFor } from "@/lib/artists/hostAllowedFor";

describe("hostAllowedFor", () => {
  it("allows only x.com hosts for x", () => {
    expect(hostAllowedFor("x", "https://x.com/a")).toBe(true);
    expect(hostAllowedFor("x", "mobile.x.com/a")).toBe(true);
    expect(hostAllowedFor("x", "https://max.com/a")).toBe(false);
  });

  it("allows only English Wikipedia for wikipedia", () => {
    expect(hostAllowedFor("wikipedia", "https://en.wikipedia.org/wiki/A")).toBe(true);
    expect(hostAllowedFor("wikipedia", "en.m.wikipedia.org/wiki/A")).toBe(true);
    expect(hostAllowedFor("wikipedia", "https://de.wikipedia.org/wiki/A")).toBe(false);
  });

  it("rejects an unparseable url for those two and allows every other platform", () => {
    expect(hostAllowedFor("x", "https://")).toBe(false);
    expect(hostAllowedFor("instagram", "anything")).toBe(true);
  });
});

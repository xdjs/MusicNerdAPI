import { describe, it, expect } from "vitest";
import { isProbeHit } from "@/lib/discovery/isProbeHit";

describe("isProbeHit", () => {
  it("is a hit when the title plausibly matches the artist name", () => {
    expect(
      isProbeHit({ imageUrl: null, title: "Pete Rango (@p3t3rango) on X" }, "Pete Rango"),
    ).toBe(true);
  });

  it("is a miss when the title belongs to someone else, even with an image", () => {
    expect(isProbeHit({ imageUrl: "https://i", title: "Peter Lyrøholm" }, "Pete Rango")).toBe(
      false,
    );
  });

  it("trusts an image alone when no title came back, and misses with neither", () => {
    expect(isProbeHit({ imageUrl: "https://i", title: null }, "Pete Rango")).toBe(true);
    expect(isProbeHit({ imageUrl: null, title: null }, "Pete Rango")).toBe(false);
  });
});

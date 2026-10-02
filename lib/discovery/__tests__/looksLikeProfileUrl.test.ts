import { describe, it, expect } from "vitest";
import { looksLikeProfileUrl } from "@/lib/discovery/looksLikeProfileUrl";

describe("looksLikeProfileUrl", () => {
  it("accepts a single path segment or a bare domain (Bandcamp)", () => {
    expect(looksLikeProfileUrl("https://instagram.com/peterango")).toBe(true);
    expect(looksLikeProfileUrl("https://youtube.com/@peterango")).toBe(true);
    expect(looksLikeProfileUrl("https://peterango.bandcamp.com")).toBe(true);
  });

  it("rejects reels, watch queries, extra segments, a bare @ and garbage", () => {
    expect(looksLikeProfileUrl("https://instagram.com/reel/abc")).toBe(false);
    expect(looksLikeProfileUrl("https://youtube.com/watch?v=abc")).toBe(false);
    expect(looksLikeProfileUrl("https://twitch.tv/pete/about")).toBe(false);
    expect(looksLikeProfileUrl("https://x.com/@")).toBe(false);
    expect(looksLikeProfileUrl("nope")).toBe(false);
  });
});

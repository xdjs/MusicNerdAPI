import { describe, it, expect } from "vitest";
import { hostOf } from "@/lib/sources/hostOf";

describe("hostOf", () => {
  it("returns the lowercase host without www", () => {
    expect(hostOf("https://WWW.Discogs.com/artist/1")).toBe("discogs.com");
  });

  it("returns an empty string for a URL it cannot parse", () => {
    expect(hostOf("not a url")).toBe("");
  });
});

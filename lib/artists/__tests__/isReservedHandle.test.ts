import { describe, it, expect } from "vitest";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";

describe("isReservedHandle", () => {
  it.each([
    ["subvert", "@ChangeLog"],
    ["subvert", "privacy-policy"],
    ["subvert", "author"],
    ["soundcloud", "terms-of-use"],
    ["audius", "documents"],
    ["mixcloud", "premium"],
    ["supercollector", "about"],
    ["bandcamp", "daily"],
  ])("rejects reserved music routes %s/%s during handle adoption", (platform, handle) => {
    expect(isReservedHandle(platform, handle)).toBe(true);
  });
  it("rejects platform routes that urlmap patterns capture as a handle", () => {
    expect(isReservedHandle("instagram", "p")).toBe(true);
    expect(isReservedHandle("instagram", "reel")).toBe(true);
    expect(isReservedHandle("x", "artists")).toBe(true);
    expect(isReservedHandle("x", "status")).toBe(true);
    expect(isReservedHandle("spotify", "track")).toBe(true);
    expect(isReservedHandle("youtube", "watch")).toBe(true);
  });

  it("is case-insensitive and ignores a leading @", () => {
    expect(isReservedHandle("Instagram", "@Reels")).toBe(true);
  });

  it("treats an empty or one-character id as reserved on any platform", () => {
    expect(isReservedHandle("soundcloud", "")).toBe(true);
    expect(isReservedHandle("bandcamp", "a")).toBe(true);
  });

  it("accepts real handles, including a route word on a platform where it is not reserved", () => {
    expect(isReservedHandle("instagram", "p3t3rango")).toBe(false);
    expect(isReservedHandle("soundcloud", "status")).toBe(false);
    expect(isReservedHandle("discogs", "p")).toBe(true);
  });
});

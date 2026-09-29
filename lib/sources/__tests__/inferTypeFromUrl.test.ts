import { describe, it, expect } from "vitest";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";

describe("inferTypeFromUrl", () => {
  it("types by domain, including subdomains", () => {
    expect(inferTypeFromUrl("https://pitchfork.com/x")).toBe("review");
    expect(inferTypeFromUrl("https://www.youtube.com/watch?v=1")).toBe("video");
    expect(inferTypeFromUrl("https://en.wikipedia.org/wiki/X")).toBe("profile");
    expect(inferTypeFromUrl("https://artist.bandcamp.com/album/x")).toBe("audio");
  });

  it("then by path keyword", () => {
    expect(inferTypeFromUrl("https://zine.example/interviews/pete")).toBe("interview");
    expect(inferTypeFromUrl("https://zine.example/Reviews/x")).toBe("review");
  });

  it("falls back to article, never website", () => {
    expect(inferTypeFromUrl("https://peterango.com")).toBe("article");
    expect(inferTypeFromUrl("not a url")).toBe("article");
  });
});

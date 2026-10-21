import { describe, it, expect } from "vitest";
import { canonicalizeDestinationUrl } from "@/lib/sources/canonicalizeDestinationUrl";

describe("canonicalizeDestinationUrl", () => {
  it("serializes a public URL, adding https to a bare domain", () => {
    expect(canonicalizeDestinationUrl("Example.com/a")).toBe("https://example.com/a");
  });

  it("keeps the query and hash, which may be distinct destinations", () => {
    expect(canonicalizeDestinationUrl("https://example.com/#/music?x=1")).toBe(
      "https://example.com/#/music?x=1",
    );
  });

  it("returns null for anything that isn't a public URL", () => {
    expect(canonicalizeDestinationUrl("/relative")).toBeNull();
    expect(canonicalizeDestinationUrl("ftp://example.com")).toBeNull();
  });
});

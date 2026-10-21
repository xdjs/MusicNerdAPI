import { describe, it, expect } from "vitest";
import { normalizeStoredArtistImage } from "@/lib/artists/normalizeStoredArtistImage";

describe("normalizeStoredArtistImage", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["whitespace", "  "],
    ["a default image", "/images/default-artist.png"],
    ["a placeholder", "https://example.com/placeholder.jpg"],
    ["the logo", "/musicnerdlogo.png"],
    ["a protocol-relative path", "//cdn.example.com/a.jpg"],
    ["a backslash path", "/images\\a.jpg"],
    ["an http URL", "http://example.com/a.jpg"],
    ["a URL with credentials", "https://user:pass@example.com/a.jpg"],
    ["not a URL", "example.com/a.jpg"],
  ])("is null for %s", (_label, value) => {
    expect(normalizeStoredArtistImage(value)).toBeNull();
  });

  it("keeps a local path", () => {
    expect(normalizeStoredArtistImage(" /uploads/a.jpg ")).toBe("/uploads/a.jpg");
  });

  it("keeps a credential-free HTTPS URL, normalized", () => {
    expect(normalizeStoredArtistImage("https://example.com/a.jpg?x=1")).toBe(
      "https://example.com/a.jpg?x=1",
    );
    expect(normalizeStoredArtistImage("HTTPS://Example.com")).toBe("https://example.com/");
  });
});

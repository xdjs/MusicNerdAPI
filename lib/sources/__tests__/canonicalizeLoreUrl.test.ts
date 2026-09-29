import { describe, it, expect } from "vitest";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";

describe("canonicalizeLoreUrl", () => {
  it("drops the fragment and serializes the URL one way", () => {
    expect(canonicalizeLoreUrl("artist.example/interview#part-2")).toBe(
      "https://artist.example/interview",
    );
    expect(canonicalizeLoreUrl("https://Artist.example")).toBe("https://artist.example/");
  });

  it("returns null for input that isn't a public URL", () => {
    expect(canonicalizeLoreUrl("javascript:alert(1)")).toBeNull();
  });
});

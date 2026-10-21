import { describe, expect, it } from "vitest";
import { customImageUrl } from "@/lib/artists/customImageUrl";

describe("customImageUrl", () => {
  it("returns the trimmed upload, or null for nothing, blank or whitespace", () => {
    expect(customImageUrl(" https://cdn/x.png ")).toBe("https://cdn/x.png");
    expect(customImageUrl(null)).toBeNull();
    expect(customImageUrl(undefined)).toBeNull();
    expect(customImageUrl("")).toBeNull();
    expect(customImageUrl("   ")).toBeNull();
  });
});

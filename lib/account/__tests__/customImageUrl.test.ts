import { describe, it, expect } from "vitest";
import { customImageUrl } from "@/lib/account/customImageUrl";

describe("customImageUrl", () => {
  it("treats null, undefined and blank as no image", () => {
    expect(customImageUrl(null)).toBeNull();
    expect(customImageUrl(undefined)).toBeNull();
    expect(customImageUrl("   ")).toBeNull();
  });

  it("trims a stored value", () => {
    expect(customImageUrl(" /a.png ")).toBe("/a.png");
  });
});

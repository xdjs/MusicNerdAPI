import { describe, it, expect } from "vitest";
import { unicodeSlug } from "@/lib/questions/unicodeSlug";

describe("unicodeSlug", () => {
  it("keeps letters of any script and joins the rest with _", () => {
    expect(unicodeSlug("사랑")).toBe("사랑");
    expect(unicodeSlug("@Zavodsky.Alan")).toBe("zavodsky_alan");
    expect(unicodeSlug("y".repeat(70))).toHaveLength(60);
    expect(unicodeSlug("--")).toBe("x");
  });
});

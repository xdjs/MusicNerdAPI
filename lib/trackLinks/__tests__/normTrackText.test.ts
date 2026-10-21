import { describe, expect, it } from "vitest";
import { normTrackText } from "@/lib/trackLinks/normTrackText";

describe("normTrackText", () => {
  it("lowercases and single-spaces, keeping word boundaries", () => {
    expect(normTrackText("  Earth, Wind & Fire ")).toBe("earth wind fire");
    expect(normTrackText("Pete—Rango")).toBe("pete rango");
  });
});

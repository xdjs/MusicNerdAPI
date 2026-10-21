import { describe, expect, it } from "vitest";
import { foldTrackText } from "@/lib/trackLinks/foldTrackText";

describe("foldTrackText", () => {
  it("keeps letters and digits of any script, lowercased and run together", () => {
    expect(foldTrackText("Crying on the Floor (Mix) 2")).toBe("cryingonthefloormix2");
    expect(foldTrackText("봄날 Spring Day")).toBe("봄날springday");
    expect(foldTrackText("!!!")).toBe("");
  });
});

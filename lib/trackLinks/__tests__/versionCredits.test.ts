import { describe, expect, it } from "vitest";
import { versionCredits } from "@/lib/trackLinks/versionCredits";

describe("versionCredits", () => {
  it("returns bracketed segments that name a version, normalised", () => {
    expect(versionCredits("Crying on the Floor (Pete Rango Mix) [Remastered]")).toEqual([
      "pete rango mix",
      "remastered",
    ]);
  });

  it("ignores brackets without a version word and names in the body of the title", () => {
    expect(versionCredits("Rango Sessions (feat. Someone)")).toEqual([]);
  });
});

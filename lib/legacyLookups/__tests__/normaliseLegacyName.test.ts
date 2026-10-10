import { describe, expect, it } from "vitest";
import { normaliseLegacyName } from "@/lib/legacyLookups/normaliseLegacyName";

describe("normaliseLegacyName", () => {
  it("lowercases, strips accents and drops punctuation, keeping letters, numbers and spaces", () => {
    expect(normaliseLegacyName("Beyoncé")).toBe("beyonce");
    expect(normaliseLegacyName("AC/DC")).toBe("acdc");
    expect(normaliseLegacyName("Pete Rango!")).toBe("pete rango");
    expect(normaliseLegacyName("Sigur Rós 2")).toBe("sigur ros 2");
    expect(normaliseLegacyName("坂本龍一")).toBe("坂本龍一");
  });
});

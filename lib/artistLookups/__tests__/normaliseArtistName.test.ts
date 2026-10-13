import { describe, expect, it } from "vitest";
import { normaliseArtistName } from "@/lib/artistLookups/normaliseArtistName";

describe("normaliseArtistName", () => {
  it("lowercases, strips accents and drops punctuation, keeping letters, numbers and spaces", () => {
    expect(normaliseArtistName("Beyoncé")).toBe("beyonce");
    expect(normaliseArtistName("AC/DC")).toBe("acdc");
    expect(normaliseArtistName("Pete Rango!")).toBe("pete rango");
    expect(normaliseArtistName("Sigur Rós 2")).toBe("sigur ros 2");
    expect(normaliseArtistName("坂本龍一")).toBe("坂本龍一");
  });
});

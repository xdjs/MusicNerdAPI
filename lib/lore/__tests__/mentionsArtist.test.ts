import { describe, it, expect } from "vitest";
import { mentionsArtist } from "@/lib/lore/mentionsArtist";

describe("mentionsArtist", () => {
  it("matches the full name, or any name word of four letters or more, case-insensitively", () => {
    expect(mentionsArtist("PETE RANGO played", "Pete Rango")).toBe(true);
    expect(mentionsArtist("Rango's new record", "Pete Rango")).toBe(true);
    expect(mentionsArtist("Pete went home", "Pete Rango")).toBe(true);
    expect(mentionsArtist("Richmond venues", "Pete Rango")).toBe(false);
  });

  it("ignores short name words", () => {
    expect(mentionsArtist("the DJ set", "DJ Kx")).toBe(false);
  });
});

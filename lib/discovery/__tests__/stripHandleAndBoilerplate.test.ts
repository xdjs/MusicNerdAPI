import { describe, it, expect } from "vitest";
import { stripHandleAndBoilerplate } from "@/lib/discovery/stripHandleAndBoilerplate";

describe("stripHandleAndBoilerplate", () => {
  it("strips a bare handle followed by platform boilerplate down to nothing", () => {
    expect(stripHandleAndBoilerplate("peterango - Twitch", "peterango")).toBe("");
  });

  it("strips a parenthesised @handle and Instagram boilerplate, leaving the real (wrong) name", () => {
    expect(
      stripHandleAndBoilerplate(
        "Peter Lyrøholm (@peterango) • Instagram photos and videos",
        "peterango",
      ),
    ).toBe("Peter Lyrøholm");
  });

  it("leaves a genuine name untouched when the handle is not literally echoed", () => {
    expect(stripHandleAndBoilerplate("Pete Rango", "peterango")).toBe("Pete Rango");
  });

  it('strips "| Facebook" boilerplate and escapes regex characters in the handle', () => {
    expect(stripHandleAndBoilerplate("Pete Rango | Facebook", "pete.rango")).toBe("Pete Rango");
    expect(stripHandleAndBoilerplate("a.b (@a.b)", "a.b")).toBe("");
  });
});

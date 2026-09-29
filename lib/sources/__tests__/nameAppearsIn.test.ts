import { describe, it, expect } from "vitest";
import { nameAppearsIn } from "@/lib/sources/nameAppearsIn";

describe("nameAppearsIn", () => {
  it("matches the full name however it is spaced or cased", () => {
    expect(nameAppearsIn("An interview with PETE-RANGO about the record", "Pete Rango")).toBe(true);
  });

  it("falls back to the most distinctive token of four or more letters", () => {
    // His own homepage renders "RANGO" as a wordmark and "Pete" only in an image.
    expect(nameAppearsIn("RANGO — music and film", "Pete Rango")).toBe(true);
    // No token of four or more letters, so only the full name could match.
    expect(nameAppearsIn("the lil one", "Lil DJ")).toBe(false);
  });

  it("requires the full name for search-retrieved pages", () => {
    // "Black Dave"'s distinctive token is "black", which matches a large share of the web.
    expect(
      nameAppearsIn("Dave talks about his song Black", "Black Dave", { requireFullName: true }),
    ).toBe(false);
    expect(nameAppearsIn("Black Dave talks", "Black Dave", { requireFullName: true })).toBe(true);
  });

  it("never matches an empty name", () => {
    expect(nameAppearsIn("anything", "  ")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { docSystemInstruction } from "@/lib/lore/docSystemInstruction";

describe("docSystemInstruction", () => {
  const text = docSystemInstruction("Nova Reyes", "2026-09-29");

  it("names the artist and today's date", () => {
    expect(text).toContain('the music artist "Nova Reyes"');
    expect(text).toContain("TIME — today is 2026-09-29.");
  });

  it("carries the section list and the citation, correction and anti-inflation rules", () => {
    for (const part of [
      "## Story hooks",
      "CITATIONS",
      "CORRECTIONS —",
      "ANTI-INFLATION",
      "## In Their Own Words",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("has no example artist to borrow anecdotes from", () => {
    for (const leaked of ["the pantry", "Marisol", "Late Bus"]) expect(text).not.toContain(leaked);
  });
});

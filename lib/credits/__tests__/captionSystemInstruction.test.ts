import { describe, it, expect } from "vitest";
import { captionSystemInstruction } from "@/lib/credits/captionSystemInstruction";

describe("captionSystemInstruction", () => {
  it("names the artist and their handle, and asks for credits and statements as JSON", () => {
    const text = captionSystemInstruction("Bio Ritmo", "bioritmo");
    expect(
      text.startsWith(
        "You are reading Instagram captions written by the musician Bio Ritmo (@bioritmo).",
      ),
    ).toBe(true);
    expect(text).toContain('Return JSON: {"credits": [...], "statements": [...]}');
    expect(text).toContain("role     - the job, in Bio Ritmo's OWN WORDS. AT MOST SIX WORDS.");
    expect(text).toContain("A ROLE IS NEVER A USERNAME.");
    expect(text.endsWith("Leave it out.")).toBe(true);
  });

  it("leaves the handle out when there is none", () => {
    expect(captionSystemInstruction("Bio Ritmo", "")).toMatch(
      /^You are reading Instagram captions written by the musician Bio Ritmo\.\n/,
    );
  });
});

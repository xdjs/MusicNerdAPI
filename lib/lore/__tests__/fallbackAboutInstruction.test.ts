import { describe, it, expect } from "vitest";
import { ABOUT_LENGTH_RULE, ABOUT_OPENING_RULE, ABOUT_STOP_RULE } from "@/lib/bio/const";
import { fallbackAboutInstruction } from "@/lib/lore/fallbackAboutInstruction";

describe("fallbackAboutInstruction", () => {
  const text = fallbackAboutInstruction("Nova Reyes");

  it("names the artist and carries the shared rules, with no citation markers", () => {
    expect(text).toMatch(/^You write the public "About" for the music artist "Nova Reyes"/);
    expect(text).toContain(
      `- ${ABOUT_LENGTH_RULE} ${ABOUT_STOP_RULE} Plain text only — no markdown, no headers, no citation markers or bracketed numbers.`,
    );
    expect(text).toContain(`- ${ABOUT_OPENING_RULE}`);
    expect(text).toMatch(/no quotation marks/i);
    expect(text).not.toContain("2-4 short paragraphs");
  });
});

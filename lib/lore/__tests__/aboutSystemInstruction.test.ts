import { describe, it, expect } from "vitest";
import { ABOUT_LENGTH_RULE, ABOUT_OPENING_RULE, ABOUT_STOP_RULE } from "@/lib/bio/const";
import { aboutSystemInstruction } from "@/lib/lore/aboutSystemInstruction";

describe("aboutSystemInstruction", () => {
  const text = aboutSystemInstruction("Nova Reyes");

  it("names the artist and carries the shared length, stop and opening rules", () => {
    expect(text).toMatch(/^You are a music writer\. Write the public "About" for "Nova Reyes"/);
    expect(text).toContain(`- ${ABOUT_LENGTH_RULE} ${ABOUT_STOP_RULE} Plain text only`);
    expect(text).toContain(`- ${ABOUT_OPENING_RULE}`);
    expect(text).not.toContain("2-4 short paragraphs");
  });

  it("keeps the document's citations and asks for no quotation marks", () => {
    expect(text).toContain("keep its [n] marker immediately after it");
    expect(text).toMatch(/no quotation marks/i);
    expect(text).not.toMatch(/keep the quote/i);
  });
});

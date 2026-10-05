import { describe, expect, it } from "vitest";
import { tokenizeKnowledgeText } from "@/lib/knowledge/tokenizeKnowledgeText";

describe("tokenizeKnowledgeText", () => {
  it("matches English inflections without changing their original text", () => {
    const tokens = tokenizeKnowledgeText("arrange arranging sequence sequencing");
    expect(tokens.map(t => t.stem)).toEqual(["arrang", "arrang", "sequenc", "sequenc"]);
    expect(tokens.map(t => t.term)).toEqual(["arrange", "arranging", "sequence", "sequencing"]);
  });
  it("folds only matching terms and preserves original UTF-16 locations", () => {
    const text = "🎵 Jawn’adelphia, Lucía, COLÓN and 東京";
    const tokens = tokenizeKnowledgeText(text);
    expect(tokens.map(t => t.term)).toEqual(["jawnadelphia", "lucia", "colon", "and", "東京"]);
    expect(tokens.map(t => text.slice(t.start, t.end))).toEqual([
      "Jawn’adelphia",
      "Lucía",
      "COLÓN",
      "and",
      "東京",
    ]);
    expect(tokens[0].start).toBe(3);
  });
});

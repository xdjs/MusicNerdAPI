/**
 * Strips link artifacts out of an About: models still emit inline citations,
 * and rows written by the old web-search generator are full of them. Applied
 * when an About is generated and when one is read, so stored rows show clean.
 *
 * @param text - The About.
 * @returns The prose without markdown links, bare URLs or emptied brackets; "" for none.
 */
export function sanitizeBioText(text: string | null | undefined): string {
  if (!text) return "";

  return (
    text
      // Parenthesized citations, "( [label](url) )": drop the whole group.
      .replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, "")
      // Inline markdown links carrying real sentence content: keep just the label.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Bare URLs. The last character class keeps trailing sentence punctuation.
      .replace(/https?:\/\/[^\s)\]]*[^\s)\].,;:!?]/g, "")
      // Parens and brackets emptied by the removals above.
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      // Whitespace left behind: collapse runs, pull punctuation back onto the word.
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([.,;:!?])/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

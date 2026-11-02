import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";

/** Navigation only: retain the matching block and adjacent preceding context, never skip blocks. */
export function getDiscoveryPassage(
  text: string,
  match: { start: number; end: number; anchor: number },
) {
  const maxChars = 800;
  const ranked = text.slice(match.start, match.end);
  const paragraphs = [...ranked.matchAll(/\r?\n[\t ]*\r?\n/g)];
  const separators = paragraphs.length ? paragraphs : [...ranked.matchAll(/\r?\n/g)];
  const blocks: { start: number; end: number }[] = [];
  let start = match.start;
  for (const separator of separators) {
    const end = match.start + separator.index;
    blocks.push({ start, end });
    start = end + separator[0].length;
  }
  blocks.push({ start, end: match.end });
  const index = blocks.findIndex(block => block.start <= match.anchor && match.anchor < block.end);
  const block = blocks[index] ?? { start: match.start, end: match.end };
  const overlong = block.end - block.start > maxChars;
  start = overlong
    ? Math.max(block.start, Math.min(match.anchor - 600, block.end - maxChars))
    : block.start;
  if (!overlong) {
    for (let i = index - 1; i >= 0 && block.end - blocks[i].start <= maxChars; i--) {
      start = blocks[i].start;
    }
  }
  const window = knowledgeWindow(text, start, Math.min(maxChars, block.end - start));
  return {
    ...window,
    truncated: window.start > match.start || window.end < match.end,
    // Even a complete block is not a guarantee that all governing context was extracted/ranked.
    contextIncomplete:
      overlong ||
      (block.start === match.start && match.start > 0 && text[match.start - 1] !== "\n") ||
      (block.end === match.end && match.end < text.length && text[match.end] !== "\n"),
  };
}

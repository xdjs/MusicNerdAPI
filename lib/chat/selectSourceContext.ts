/** Select a complete paragraph plus two preceding and one following blocks.
 * Keeps nearby headings/dates/qualifiers; never reconstructs missing source text.
 * Returns null for ambiguous anchors, truncated terminal blocks or oversized context.
 */
export function selectSourceContext(
  text: string,
  anchor: string,
  truncated: boolean,
): string | null {
  if (!anchor.trim() || anchor.length > 300) return null;
  const start = text.indexOf(anchor);
  if (start < 0 || text.indexOf(anchor, start + 1) >= 0) return null;
  const blocks = [...text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)];
  const index = blocks.findIndex(
    b => start >= b.index && start + anchor.length <= b.index + b[0].length,
  );
  if (index < 0) return null;
  let from = Math.max(0, index - 2);
  while (from > 0 && blocks[from - 1][0].length <= 300) from--;
  const to = Math.min(blocks.length - 1, index + 1);
  if (truncated && to === blocks.length - 1) return null;
  const context = text.slice(blocks[from].index, blocks[to].index + blocks[to][0].length);
  return context.length <= 6000 ? context : null;
}

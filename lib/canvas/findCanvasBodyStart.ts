/** Skip a structural website navigation prefix, preserving offsets into the original extraction. */
export function findCanvasBodyStart(text: string): number {
  // Require the explicit skip-navigation marker plus controls, not a prose mention of these words.
  const prefix = text.match(
    /^\s*(?:\d+\s+)?Skip to Content\s+(?:(?:English\s+){2}|(?:Menu\s+)|(?:View fullsize(?:\s+|$)))/i,
  );
  if (!prefix) return 0;
  let offset = prefix[0].length;
  const remainder =
    text.slice(offset).match(/^(?:(?:View fullsize|Open Menu|Close Menu)(?:\s+|$))*/i)?.[0] ?? "";
  offset += remainder.length;
  return offset;
}

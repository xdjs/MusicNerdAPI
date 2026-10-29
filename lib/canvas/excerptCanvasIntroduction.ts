/** Keep the public bio's words, preferring a complete short sentence over an abrupt cut. */
export function excerptCanvasIntroduction(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 420) return normalized;
  const prefix = normalized.slice(0, 420);
  const boundary = [...prefix.matchAll(/[.!?](?:\s|$)/g)].at(-1)?.index;
  if (boundary !== undefined && boundary >= 100) return prefix.slice(0, boundary + 1);
  return `${prefix.slice(0, prefix.lastIndexOf(" "))}…`;
}

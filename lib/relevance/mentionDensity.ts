import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { escapeRegExp } from "@/lib/text/escapeRegExp";

/**
 * How much of a page is about the artist: paragraphs naming them (by full
 * name, longest distinctive token, or a confirmed handle) over paragraphs in
 * total. Handed to the judge as evidence, not thresholded: it separates
 * coverage from an index, whose first screen looks like a headline.
 *
 * @param text - The page text, paragraphs separated by blank lines.
 * @param artistName - The artist's name.
 * @param identifiers - Confirmed accounts, in "instagram: p3t3rango" form.
 * @returns The counts, or null when the text has no paragraph structure to count (under 4 paragraphs) or no name.
 */
export function mentionDensity(
  text: string,
  artistName: string,
  identifiers: string[] = [],
): { hits: number; total: number } | null {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
  if (paragraphs.length < 4) return null;
  const name = artistName.trim().toLowerCase();
  if (!name) return null;
  const handles = identifiers
    .map(i => normalizeHandle(i.split(":").pop() ?? ""))
    .filter(h => h.length >= 4 && !/^https?$/.test(h));
  // Flexible whitespace: "Pete  Rango" and "Pete\nRango" are the same mention.
  const nameRe = new RegExp(name.split(/\s+/).map(escapeRegExp).join("\\s+"), "i");
  const longest = name
    .split(/\s+/)
    .filter(t => t.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  const tokenRe = longest ? new RegExp(`\\b${escapeRegExp(longest)}`, "i") : null;
  const hits = paragraphs.filter(p => {
    const low = p.toLowerCase();
    return nameRe.test(p) || (tokenRe?.test(p) ?? false) || handles.some(h => low.includes(h));
  }).length;
  return { hits, total: paragraphs.length };
}

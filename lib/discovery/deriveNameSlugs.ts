import { MAX_DERIVED_SLUGS } from "@/lib/discovery/const";

/**
 * Handle guesses from an artist's name, the way artists pick handles:
 * "peterango", "pete-rango", and for a two-word name "pete.rango" and
 * "pete_rango".
 *
 * @param artistName - The artist's name.
 * @returns Up to `MAX_DERIVED_SLUGS` distinct slugs.
 */
export function deriveNameSlugs(artistName: string): string[] {
  const words = artistName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const slugs = [words.join("")];
  if (words.length > 1) slugs.push(words.join("-"));
  if (words.length === 2) slugs.push(words.join("."), words.join("_"));
  return [...new Set(slugs.filter(Boolean))].slice(0, MAX_DERIVED_SLUGS);
}

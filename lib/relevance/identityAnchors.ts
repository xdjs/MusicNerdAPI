import type { ArtistAnchor } from "@/lib/relevance/types";

/** Distinguishing existing facts, retaining stable IDs from the bounded anchor lists. */
export function identityAnchors(
  anchor: ArtistAnchor,
): { id: string; label: string; value: string }[] {
  const name = anchor.name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  return [
    ...(anchor.catalog ?? [])
      .slice(0, 12)
      .map((value, i) => ({ id: `C${i}`, label: `release: ${value}`, value })),
    ...(anchor.groups ?? [])
      .slice(0, 12)
      .filter(group => /^https:\/\/api\.discogs\.com\/artists\/[1-9]\d*$/.test(group.sourceUrl))
      .map((group, i) => ({
        id: `G${i}`,
        label: `current/former group: ${group.name} (source: ${group.sourceUrl})`,
        value: group.name,
      })),
    ...(anchor.identifiers ?? []).slice(0, 12).map((label, i) => ({
      id: `A${i}`,
      label,
      value: label.slice(label.indexOf(":") + 1).trim(),
    })),
  ].filter(({ value }) => {
    const folded = value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
    return folded.length >= 4 && folded !== name && !/^\d+$/.test(folded);
  });
}

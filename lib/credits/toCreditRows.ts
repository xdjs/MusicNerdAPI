import type { CaptionExtraction } from "@/lib/credits/types";

/**
 * An extraction as `artist_social_credits` rows. A credit's label is its role;
 * a statement's is its topic.
 *
 * @param artistId - The artist.
 * @param extraction - What was read.
 * @param postedAtByUrl - Each post's publication date, when stored.
 * @returns The rows to insert.
 */
export function toCreditRows(
  artistId: string,
  extraction: CaptionExtraction,
  postedAtByUrl?: Map<string, string | null>,
) {
  return [
    ...extraction.credits.map(c => ({
      artistId,
      kind: "credit" as const,
      subject: c.subject,
      isHandle: c.isHandle,
      isSelf: c.isSelf,
      label: c.role,
      quote: c.quote,
      sourceUrl: c.url,
      postedAt: postedAtByUrl?.get(c.url) ?? null,
    })),
    ...extraction.statements.map(s => ({
      artistId,
      kind: "statement" as const,
      subject: null,
      isHandle: false,
      isSelf: false,
      label: s.topic,
      quote: s.quote,
      sourceUrl: s.url,
      postedAt: postedAtByUrl?.get(s.url) ?? null,
    })),
  ];
}

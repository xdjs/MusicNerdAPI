import { creditedCollaborators } from "@/lib/credits/creditedCollaborators";
import type { CaptionExtraction } from "@/lib/credits/types";
import { TOP_CREDITS } from "@/lib/questions/const";
import type { SignalCandidate } from "@/lib/questions/types";
import { unicodeSlug } from "@/lib/questions/unicodeSlug";

/**
 * People the artist credited with a role in their own captions: the strongest
 * material there is. The material is the artist's sentences, one caption per
 * line, never bare labels: "added some 808s" reads as a contribution until you
 * see "but those files were lost".
 *
 * @param artistName - The artist.
 * @param extraction - The artist's stored caption credits.
 * @returns Up to TOP_CREDITS candidates, with at most three quotes each.
 */
export function creditCandidates(
  artistName: string,
  extraction: CaptionExtraction,
): SignalCandidate[] {
  return creditedCollaborators(extraction)
    .slice(0, TOP_CREDITS)
    .map(c => {
      const subject = c.isHandle ? `@${c.subject}` : c.subject;
      const id = unicodeSlug(c.subject);
      const quotes = [...new Set(c.quotes.map(q => q.trim()).filter(Boolean))].slice(0, 3);
      return {
        signalId: `credit_${id}`,
        kind: "credit",
        key: `social_credit_${id}`,
        authoredBy: "artist",
        material:
          `${artistName} wrote these about ${subject}. Each line below is ONE caption:\n` +
          quotes.map(q => `  "${q}"`).join("\n") +
          `\nAnything inside a single line was written together and belongs together. Facts from DIFFERENT lines do not: they are separate posts about separate occasions, so do not merge them into one description of ${subject}, and do not present something from one post as what they generally do. Read what the sentences actually say — they may contradict what the phrasing suggests.`,
        sourceUrls: c.evidenceUrls,
      };
    });
}

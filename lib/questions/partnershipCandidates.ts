import { creditedCollaborators } from "@/lib/credits/creditedCollaborators";
import type { CaptionExtraction } from "@/lib/credits/types";
import { TOP_PARTNERSHIPS } from "@/lib/questions/const";
import type { SignalCandidate } from "@/lib/questions/types";
import { unicodeSlug } from "@/lib/questions/unicodeSlug";

/**
 * Collaborators credited on two or more posts: a working relationship we
 * computed, not one the model guessed. The material states only the roles that
 * recur (a one-off belongs to its own post) and no count, which the model
 * would recite.
 *
 * @param artistName - The artist.
 * @param extraction - The artist's stored caption credits.
 * @returns Up to TOP_PARTNERSHIPS candidates.
 */
export function partnershipCandidates(
  artistName: string,
  extraction: CaptionExtraction,
): SignalCandidate[] {
  return creditedCollaborators(extraction)
    .filter(c => c.evidenceUrls.length >= 2)
    .slice(0, TOP_PARTNERSHIPS)
    .map(c => {
      const subject = c.isHandle ? `@${c.subject}` : c.subject;
      const id = unicodeSlug(c.subject);
      return {
        signalId: `partnership_${id}`,
        kind: "partnership",
        key: `social_partnership_${id}`,
        authoredBy: "artist",
        material:
          `${artistName} has credited ${subject} on several SEPARATE posts, in their own words each time` +
          (c.recurringRoles.length > 0 ? `, repeatedly as: ${c.recurringRoles.join("; ")}.` : `.`) +
          ` That is a working relationship rather than a one-off. NOTE: this says only that ${subject} was credited on those posts — it does NOT say which records those posts were about, you must not attach ${subject} to any release you were told about elsewhere, and you must not describe them with a role that is not listed here.`,
        sourceUrls: c.evidenceUrls,
      };
    });
}

import type { CaptionExtraction } from "@/lib/credits/types";
import { partnershipCandidates } from "@/lib/questions/partnershipCandidates";
import { samePostCandidates } from "@/lib/questions/samePostCandidates";
import type { SignalCandidate } from "@/lib/questions/types";

/**
 * Relationships joined here rather than guessed by the model: the same person
 * credited across several posts, and two things said in one post. Each
 * asserts only what the join proves, and its evidence travels with it.
 *
 * @param artistName - The artist.
 * @param extraction - The artist's stored caption credits.
 * @returns Partnership candidates, then same-post candidates.
 */
export function relationshipCandidates(
  artistName: string,
  extraction: CaptionExtraction,
): SignalCandidate[] {
  return [
    ...partnershipCandidates(artistName, extraction),
    ...samePostCandidates(artistName, extraction),
  ];
}

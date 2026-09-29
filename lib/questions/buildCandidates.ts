import type { CaptionExtraction } from "@/lib/credits/types";
import { collaboratorCandidates } from "@/lib/questions/collaboratorCandidates";
import { creditCandidates } from "@/lib/questions/creditCandidates";
import { musicCandidates } from "@/lib/questions/musicCandidates";
import { relationshipCandidates } from "@/lib/questions/relationshipCandidates";
import { standoutCandidates } from "@/lib/questions/standoutCandidates";
import { statementCandidates } from "@/lib/questions/statementCandidates";
import { themeCandidates } from "@/lib/questions/themeCandidates";
import type { SignalCandidate } from "@/lib/questions/types";
import type { SocialSignals } from "@/lib/socialSignals/types";

/**
 * Every signal offered to the model, strongest material first: computed
 * relationships, then credits and statements in the artist's words, then what
 * was counted from the posts.
 *
 * @param signals - Signals derived from the posts.
 * @param artistName - The artist.
 * @param extraction - The artist's stored caption credits.
 * @returns The candidates, in the order the model sees them.
 */
export function buildCandidates(
  signals: SocialSignals,
  artistName: string,
  extraction: CaptionExtraction,
): SignalCandidate[] {
  return [
    ...relationshipCandidates(artistName, extraction),
    ...creditCandidates(artistName, extraction),
    ...statementCandidates(artistName, extraction.statements),
    ...collaboratorCandidates(artistName, signals.collaborators),
    ...themeCandidates(artistName, signals.themes),
    ...standoutCandidates(artistName, signals.standoutPosts),
    ...musicCandidates(artistName, signals.musicReferences),
  ];
}

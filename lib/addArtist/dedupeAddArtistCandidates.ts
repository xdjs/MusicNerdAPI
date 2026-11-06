import type { AddArtistCandidate } from "@/lib/addArtist/types";

/**
 * One candidate per artist, first one wins, in order.
 *
 * @param candidates - The candidates.
 * @returns The candidates without repeats.
 */
export function dedupeAddArtistCandidates(candidates: AddArtistCandidate[]): AddArtistCandidate[] {
  return [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()];
}

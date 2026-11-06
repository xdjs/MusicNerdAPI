import type { ReciprocalArtistIdentity } from "@/lib/catalogIdentity/types";

/**
 * The record that linked the two platforms, with its id, for a mapping's reasoning.
 *
 * @param identity - The counterpart.
 * @returns e.g. `Wikidata Q44190`.
 */
export function reciprocalSourceEvidence(identity: ReciprocalArtistIdentity): string {
  return identity.source === "wikidata"
    ? `Wikidata ${identity.wikidataId}`
    : `MusicBrainz ${identity.musicbrainzId}`;
}

import type { ReciprocalArtistIdentity } from "@/lib/catalogIdentity/types";

/**
 * The public record that linked the two platforms, by name.
 *
 * @param identity - The counterpart.
 * @returns `Wikidata` or `MusicBrainz`.
 */
export function reciprocalSourceLabel(identity: ReciprocalArtistIdentity): string {
  return identity.source === "wikidata" ? "Wikidata" : "MusicBrainz";
}

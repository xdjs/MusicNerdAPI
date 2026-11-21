import type { MusicPlatform } from "@/lib/musicPlatform/types";

/** An artist's identity on one catalog platform. */
export type CatalogArtistIdentity = { platform: MusicPlatform; platformId: string; name: string };

/** The same artist's id on the other platform, and the public record that links the two. */
export type ReciprocalArtistIdentity = { platform: MusicPlatform; platformId: string } & (
  { source: "wikidata"; wikidataId: string } | { source: "musicbrainz"; musicbrainzId: string }
);

/** What Wikidata says about the other platform's id. */
export type WikidataLookupResult =
  | { status: "miss" }
  | { status: "ambiguous" }
  | { status: "match"; platformId: string; wikidataId: string };

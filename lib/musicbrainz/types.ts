/** An artist's links from MusicBrainz, and how we know the entry is theirs. */
export type MusicBrainzLinks = {
  /** "identifier": the entry links a Spotify or Deezer id we hold. "exact-name": the name alone. */
  matchedBy: "identifier" | "exact-name";
  /** Every url MusicBrainz holds, for the caller to resolve and verify. */
  urls: string[];
  /** Their official site, if named: the hub the search pass otherwise hunts for. */
  homepage: string | null;
};

export type MusicBrainzRequestResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not-found" }
  | { status: "unavailable" };

/** The other platform's id for an artist, and the MusicBrainz entry that links both. */
export type MusicBrainzCounterpart = { platformId: string; musicbrainzId: string };

/** How a URL reads as a platform's artist page. */
export type PlatformArtistUrlMatch =
  { status: "unrelated" } | { status: "invalid" } | { status: "valid"; platformId: string };

/** A MusicBrainz entry's relations that have not ended, or invalid when malformed. */
export type ActiveRelationsResult =
  { status: "ok"; relations: Array<Record<string, unknown>> } | { status: "invalid" };

/** The artists a MusicBrainz URL entry belongs to, or invalid when malformed. */
export type ArtistRelationIdsResult = { status: "ok"; ids: Set<string> } | { status: "invalid" };

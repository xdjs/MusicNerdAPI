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

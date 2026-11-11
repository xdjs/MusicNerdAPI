/** Unsupported URLs and non-artist identities must not become a fuzzy name search. */
export class InvalidArtistSearchQueryError extends Error {
  constructor() {
    super("Use a Spotify or Deezer artist link or ID.");
    this.name = "InvalidArtistSearchQueryError";
  }
}

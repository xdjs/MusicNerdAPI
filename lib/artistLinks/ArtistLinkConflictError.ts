/** A platform id is already another artist's, directly or through a mapping. */
export class ArtistLinkConflictError extends Error {
  /**
   * @param message - What conflicted.
   */
  constructor(message: string) {
    super(message);
    this.name = "ArtistLinkConflictError";
  }
}

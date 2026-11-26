/** A revocation stopped because a Lore source's provenance is unknown; nothing was changed.
 *  The message is MusicNerdWeb's, shown to the admin. */
export class RevocationReviewRequiredError extends Error {
  /** Builds the error with MusicNerdWeb's admin-facing message. */
  constructor() {
    super(
      "Revocation needs source-retention review because some Lore provenance is unknown. No changes were made.",
    );
    this.name = "RevocationReviewRequiredError";
  }
}

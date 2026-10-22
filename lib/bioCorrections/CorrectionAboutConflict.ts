/**
 * An About correction cannot proceed as asked: the report was reviewed, the
 * About is pinned or gone, or the revision no longer matches. Reported as 409
 * with this message, which the admin sees.
 */
export class CorrectionAboutConflict extends Error {
  /**
   * Builds the conflict with its user-facing message.
   *
   * @param message - What changed, in the admin's words.
   */
  constructor(message: string) {
    super(message);
    this.name = "CorrectionAboutConflict";
  }
}

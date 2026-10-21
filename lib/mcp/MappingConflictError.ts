/** The platform id is already another artist's, directly or through a mapping. */
export class MappingConflictError extends Error {
  /**
   * @param message - What went wrong.
   */
  constructor(message: string) {
    super(message);
    this.name = "MappingConflictError";
  }
}

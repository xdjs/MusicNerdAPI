/** A platform, source, confidence, reason or id the mapping tools refuse. */
export class MappingValidationError extends Error {
  /**
   * @param message - What went wrong.
   */
  constructor(message: string) {
    super(message);
    this.name = "MappingValidationError";
  }
}

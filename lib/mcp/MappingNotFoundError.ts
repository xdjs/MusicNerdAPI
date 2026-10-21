/** The artist a mapping names does not exist. */
export class MappingNotFoundError extends Error {
  /**
   * @param message - What went wrong.
   */
  constructor(message: string) {
    super(message);
    this.name = "MappingNotFoundError";
  }
}

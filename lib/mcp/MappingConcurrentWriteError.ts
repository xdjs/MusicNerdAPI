/** Another request wrote the same artist and platform first; not an error for the caller. */
export class MappingConcurrentWriteError extends Error {
  /**
   * @param message - What went wrong.
   */
  constructor(message: string) {
    super(message);
    this.name = "MappingConcurrentWriteError";
  }
}

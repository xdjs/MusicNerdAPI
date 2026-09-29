/** The artist's claim changed under a running job, so its writes are cancelled. */
export class OwnershipChangedError extends Error {
  /** Builds the error with MusicNerdWeb's message, which its logs and tests match on. */
  constructor() {
    super("Artist ownership changed; this operation was cancelled.");
  }
}

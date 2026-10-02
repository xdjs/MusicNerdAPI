/** Generated text lost a race with an artist edit or pin. Never report it as success;
 *  the message is shown to the artist. */
export class BioConflictError extends Error {
  /** Builds the error with MusicNerdWeb's user-facing message. */
  constructor() {
    super(
      "Your bio changed or was pinned while generation was running. Your current bio is safe; review it before trying again.",
    );
    this.name = "BioConflictError";
  }
}

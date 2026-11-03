/** Saved evidence or the document changed while generation was running. */
export class LoreChangedError extends Error {
  constructor() {
    super(
      "Lore sources changed while preparing About. Please try again. Your existing About has been kept.",
    );
  }
}

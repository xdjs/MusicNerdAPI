/** One input could not be embedded; carries its position, never its text. */
export class EmbeddingInputError extends Error {
  override readonly name = "EmbeddingInputError";

  constructor(
    readonly index: number,
    readonly total: number,
    cause: unknown,
  ) {
    super(`embedding failed for input ${index} of ${total}`, { cause });
  }
}

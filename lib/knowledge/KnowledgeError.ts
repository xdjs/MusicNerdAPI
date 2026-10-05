/** A safe public failure: never include a database or provider exception. */
export class KnowledgeError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

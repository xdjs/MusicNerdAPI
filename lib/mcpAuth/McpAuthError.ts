/** A write tool was called without a validated MCP API key. */
export class McpAuthError extends Error {
  /**
   * @param message - Why the call was refused.
   */
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

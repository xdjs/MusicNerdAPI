/**
 * Thrown when an MCP operation requires authentication but the request
 * is not authenticated or the key is invalid/revoked.
 */
export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

import { mcpRequestContext } from "@/lib/mcpAuth/mcpRequestContext";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";

/**
 * Require MCP authentication from the current request context.
 * Throws McpAuthError if the request is not authenticated.
 *
 * @returns The authenticated API key hash.
 */
export function requireMcpAuth(): string {
  const ctx = mcpRequestContext.getStore();
  if (!ctx?.apiKeyHash) {
    throw new McpAuthError("Authentication required");
  }
  return ctx.apiKeyHash;
}

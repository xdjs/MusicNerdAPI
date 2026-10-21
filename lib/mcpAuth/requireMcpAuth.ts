import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";
import { mcpRequestContext } from "@/lib/mcpAuth/mcpRequestContext";

/**
 * The validated key's hash for the current MCP request. Every mutating tool
 * calls this first, before any database work.
 *
 * @returns The key hash.
 */
export function requireMcpAuth(): string {
  const ctx = mcpRequestContext.getStore();
  if (!ctx?.apiKeyHash) throw new McpAuthError("Authentication required");
  return ctx.apiKeyHash;
}

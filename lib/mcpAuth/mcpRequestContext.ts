import { AsyncLocalStorage } from "node:async_hooks";

/** What an authenticated MCP request carries: the validated key's hash. */
export type McpRequestContext = {
  apiKeyHash: string;
};

/**
 * The per-request store the MCP route opens for an authenticated request, so
 * a write tool can demand the key's hash without the transport passing it.
 */
export const mcpRequestContext = new AsyncLocalStorage<McpRequestContext>();

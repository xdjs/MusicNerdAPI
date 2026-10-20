import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context carrying the authenticated MCP API key hash.
 * Set by the MCP route handler when a valid Bearer token is present.
 */
export const mcpRequestContext = new AsyncLocalStorage<{ apiKeyHash: string }>();

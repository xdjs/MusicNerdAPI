import crypto from "node:crypto";

/**
 * The SHA-256 hex digest of an MCP API key, which is what `mcp_api_keys` and
 * the audit rows store; the raw key is never kept.
 *
 * @param key - The raw key.
 * @returns The 64-character lowercase hex digest.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

import crypto from "crypto";

/**
 * SHA-256 hash of an MCP API key for safe storage and lookup.
 *
 * @param key - The raw API key string.
 * @returns Hex-encoded SHA-256 digest.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

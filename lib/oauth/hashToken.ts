import { createHash } from "node:crypto";

/**
 * The SHA-256 hex digest of a token, which is all `oauth_tokens` stores.
 *
 * @param token - The raw token.
 * @returns The 64-character lowercase hex digest.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

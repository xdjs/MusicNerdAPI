import { randomBytes } from "node:crypto";
import { TOKEN_PREFIXES } from "@/lib/oauth/const";
import type { OAuthTokenKind } from "@/lib/oauth/types";

/**
 * A new opaque token: 32 random bytes in base64url behind a prefix that names
 * its kind, so secret scanners can spot a leaked one.
 *
 * @param kind - What the token is.
 * @returns The token.
 */
export function generateToken(kind: OAuthTokenKind): string {
  return `${TOKEN_PREFIXES[kind]}${randomBytes(32).toString("base64url")}`;
}

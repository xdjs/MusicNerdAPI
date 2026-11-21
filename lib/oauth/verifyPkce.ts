import { createHash } from "node:crypto";

const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

/**
 * The PKCE S256 check (RFC 7636): the verifier is 43 to 128 unreserved
 * characters and its base64url SHA-256 is the challenge.
 *
 * @param verifier - The `code_verifier` the client sent to the token endpoint.
 * @param challenge - The `code_challenge` stored with the code.
 * @returns True when the verifier matches.
 */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

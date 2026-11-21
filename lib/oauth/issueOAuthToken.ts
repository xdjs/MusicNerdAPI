import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { oauthTokens } from "@/lib/db/schema";
import { ACCESS_TOKEN_TTL_SECONDS, CODE_TTL_SECONDS } from "@/lib/oauth/const";
import { generateToken } from "@/lib/oauth/generateToken";
import { hashToken } from "@/lib/oauth/hashToken";
import type { OAuthTokenKind } from "@/lib/oauth/types";

const TTL_SECONDS: Record<OAuthTokenKind, number | null> = {
  code: CODE_TTL_SECONDS,
  access: ACCESS_TOKEN_TTL_SECONDS,
  refresh: null,
};

/**
 * Issues a token under a grant, storing only its hash. Codes last 60 seconds
 * and are bound to the PKCE challenge and redirect URI; access tokens last
 * five minutes; refresh tokens don't expire. Expiry is set by the database's
 * clock, the same clock that checks it.
 *
 * @param grantId - The grant.
 * @param kind - What to issue.
 * @param code - For a code: the challenge and redirect URI it is bound to.
 * @param code.codeChallenge - The PKCE S256 challenge.
 * @param code.redirectUri - The redirect URI of the authorization request.
 * @returns The raw token, which is never stored.
 */
export async function issueOAuthToken(
  grantId: string,
  kind: OAuthTokenKind,
  code?: { codeChallenge: string; redirectUri: string },
): Promise<string> {
  const token = generateToken(kind);
  const ttl = TTL_SECONDS[kind];
  await db.insert(oauthTokens).values({
    hash: hashToken(token),
    kind,
    grantId,
    expiresAt: ttl === null ? null : sql`now() + make_interval(secs => ${ttl})`,
    codeChallenge: code?.codeChallenge ?? null,
    redirectUri: code?.redirectUri ?? null,
  });
  return token;
}

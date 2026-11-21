import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { hashToken } from "@/lib/oauth/hashToken";
import type { OAuthTokenKind } from "@/lib/oauth/types";

type Row = {
  grant_id: string;
  client_id: string;
  code_challenge: string | null;
  redirect_uri: string | null;
};

/**
 * Uses a single-use token (a code or a refresh token) atomically: only an
 * unused, unexpired token is marked used, so of two simultaneous uses only one
 * gets the row.
 *
 * @param token - The raw token.
 * @param kind - What it must be.
 * @returns Its grant, client and code binding, or undefined when it is unknown, expired or already used.
 */
export async function consumeOAuthToken(token: string, kind: OAuthTokenKind) {
  const [row] = rowsOf(
    await db.execute(sql`
      with used as (
        update oauth_tokens set used_at = now()
        where hash = ${hashToken(token)} and kind = ${kind} and used_at is null
          and (expires_at is null or expires_at > now())
        returning grant_id, code_challenge, redirect_uri
      )
      select used.grant_id, g.client_id, used.code_challenge, used.redirect_uri
      from used join oauth_grants g on g.id = used.grant_id
    `),
  ) as Row[];
  if (!row) return undefined;
  return {
    grantId: row.grant_id,
    clientId: row.client_id,
    codeChallenge: row.code_challenge,
    redirectUri: row.redirect_uri,
  };
}

import type { TOKEN_PREFIXES } from "@/lib/oauth/const";

/** What an `oauth_tokens` row holds. */
export type OAuthTokenKind = keyof typeof TOKEN_PREFIXES;

/** A registered client. */
export type OAuthClient = { id: string; name: string; redirectUris: string[] };

/** An authorization request, checked against its client. */
export type AuthorizeValidation =
  | {
      ok: true;
      client: OAuthClient;
      redirectUri: string;
      codeChallenge: string;
      state: string | null;
    }
  /** Unknown client or unregistered redirect: answer here, never redirect. */
  | { ok: false; redirectUri: null }
  /** Any other problem: send the error back to the client's redirect URI. */
  | {
      ok: false;
      redirectUri: string;
      error: string;
      description: string;
      state: string | null;
    };

/** The token endpoint's success body (RFC 6749 section 5.1). */
export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

/** One connected agent, as `GET /api/oauth/connections` lists it. */
export type OAuthConnection = {
  id: string;
  agent: string;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
};

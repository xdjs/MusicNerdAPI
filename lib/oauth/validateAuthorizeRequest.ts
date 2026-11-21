import { MCP_SCOPE } from "@/lib/oauth/const";
import { findOAuthClient } from "@/lib/oauth/findOAuthClient";
import type { AuthorizeValidation } from "@/lib/oauth/types";

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * Checks an authorization request against its registered client, for
 * `/api/oauth/auth` and both consent endpoints. The redirect URI must be one
 * the client registered, exactly; until that is known nothing may be
 * redirected. Then: `response_type=code`, a PKCE S256 challenge, the one
 * scope, and `/mcp` as the resource when one is named.
 *
 * @param params - The request's parameters (a query or a JSON body); only text values are read.
 * @param origin - The request's origin, which the resource must be on.
 * @returns The checked request, or why it was refused and whether to redirect.
 */
export async function validateAuthorizeRequest(
  params: Record<string, unknown>,
  origin: string,
): Promise<AuthorizeValidation> {
  const clientId = text(params.client_id);
  const redirectUri = text(params.redirect_uri);
  const client = clientId ? await findOAuthClient(clientId) : undefined;
  if (!client || !redirectUri || !client.redirectUris.includes(redirectUri))
    return { ok: false, redirectUri: null };

  const state = text(params.state) ?? null;
  const refuse = (error: string, description: string): AuthorizeValidation => ({
    ok: false,
    redirectUri,
    error,
    description,
    state,
  });
  const codeChallenge = text(params.code_challenge);
  const scope = text(params.scope);
  const resource = text(params.resource);

  if (text(params.response_type) !== "code")
    return refuse("unsupported_response_type", "response_type must be code");
  if (
    !codeChallenge ||
    !CHALLENGE.test(codeChallenge) ||
    text(params.code_challenge_method) !== "S256"
  )
    return refuse("invalid_request", "PKCE with S256 is required");
  if (scope && scope.split(" ").some(s => s && s !== MCP_SCOPE))
    return refuse("invalid_scope", `The only scope is ${MCP_SCOPE}`);
  if (resource && resource !== `${origin}/mcp`)
    return refuse("invalid_target", `The only resource is ${origin}/mcp`);

  return { ok: true, client, redirectUri, codeChallenge, state };
}

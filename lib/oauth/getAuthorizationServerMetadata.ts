import { MCP_SCOPE } from "@/lib/oauth/const";
import { getOAuthIssuer } from "@/lib/oauth/getOAuthIssuer";

/**
 * The OAuth authorization server metadata (RFC 8414): public clients only,
 * the authorization code flow with PKCE S256, and rotating refresh tokens.
 *
 * @param origin - The request's origin.
 * @returns The metadata document.
 */
export function getAuthorizationServerMetadata(origin: string) {
  const issuer = getOAuthIssuer(origin);
  return {
    issuer,
    authorization_endpoint: `${issuer}/auth`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/reg`,
    scopes_supported: [MCP_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  };
}

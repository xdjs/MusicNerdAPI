import { MCP_SCOPE } from "@/lib/oauth/const";
import { getOAuthIssuer } from "@/lib/oauth/getOAuthIssuer";

/**
 * The OAuth protected-resource metadata for `/mcp` (RFC 9728).
 *
 * @param origin - The request's origin.
 * @returns The metadata document.
 */
export function getResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [getOAuthIssuer(origin)],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Music Nerd",
  };
}

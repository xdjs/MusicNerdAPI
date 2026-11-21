import { getBearerToken } from "@/lib/auth/getBearerToken";
import type { McpContext } from "@/lib/mcp/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findGrantByAccessToken } from "@/lib/oauth/findGrantByAccessToken";
import { touchOAuthGrant } from "@/lib/oauth/touchOAuthGrant";
import { findTeamMember } from "@/lib/team/findTeamMember";

/**
 * Who is calling `/mcp`: an OAuth access token in `Authorization: Bearer`,
 * resolved to its connection, user and agent, whose connection is marked used. A
 * missing, expired or revoked token gets a 401 whose `WWW-Authenticate`
 * points the client at the resource metadata, where it finds how to sign in.
 *
 * @param request - The incoming request.
 * @returns The request's context, or the 401 response.
 */
export async function authenticateMcpRequest(request: Request): Promise<McpContext | Response> {
  const token = getBearerToken(request);
  const grant = token ? await findGrantByAccessToken(token) : undefined;
  if (!grant) {
    const metadata = `${new URL(request.url).origin}/.well-known/oauth-protected-resource/mcp`;
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unauthorized" },
        id: null,
      }),
      {
        status: 401,
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`,
          "Access-Control-Expose-Headers": "WWW-Authenticate",
        },
      },
    );
  }
  await touchOAuthGrant(grant.grantId);
  return {
    userId: grant.userId,
    isAdmin: grant.isAdmin,
    member: grant.email ? findTeamMember(grant.email) : null,
    grantId: grant.grantId,
    agent: grant.agent,
  };
}

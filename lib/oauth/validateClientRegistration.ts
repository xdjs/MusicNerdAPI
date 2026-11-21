import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedRedirectUri } from "@/lib/oauth/isAllowedRedirectUri";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";

const metadataSchema = z.object({ client_name: z.string().max(200).optional() });
const redirectsSchema = z.object({ redirect_uris: z.array(z.string()).min(1) });

/**
 * Reads a dynamic client registration (RFC 7591). Grant types and the token
 * auth method are ignored: every client is public and gets the code and
 * refresh grants.
 *
 * @param body - The parsed JSON body.
 * @returns The client's name and redirect URIs, or a 400 OAuth error.
 */
export function validateClientRegistration(
  body: unknown,
): { name: string; redirectUris: string[] } | NextResponse {
  const metadata = metadataSchema.safeParse(body);
  if (!metadata.success)
    return oauthErrorResponse("invalid_client_metadata", "The registration body is invalid");
  const redirects = redirectsSchema.safeParse(body);
  if (!redirects.success || !redirects.data.redirect_uris.every(isAllowedRedirectUri))
    return oauthErrorResponse(
      "invalid_redirect_uri",
      "Redirect URIs must use https, or http on localhost",
    );
  return {
    name: metadata.data.client_name?.trim() || "MCP client",
    redirectUris: redirects.data.redirect_uris,
  };
}

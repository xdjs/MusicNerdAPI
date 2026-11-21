import { getAuthorizeHandler } from "@/lib/oauth/getAuthorizeHandler";

export const dynamic = "force-dynamic";

/**
 * Starts authorization: redirects the browser to the Music Nerd sign-in page,
 * or back to the client with an error.
 *
 * @param request - The browser's request, with the authorization query.
 * @returns A 302, or a 400 or 500 in the OAuth error shape.
 */
export async function GET(request: Request) {
  return getAuthorizeHandler(request);
}

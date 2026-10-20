import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postValidateLinkHandler } from "@/lib/validateLink/postValidateLinkHandler";

export const dynamic = "force-dynamic";

/**
 * Validate an artist link URL by fetching it and checking for error pages.
 *
 * @param request - The request with a JSON body.
 * @returns Validation result or a safe error.
 */
export async function POST(request: Request) {
  return postValidateLinkHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

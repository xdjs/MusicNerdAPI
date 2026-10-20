import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postDirectEditLinkHandler } from "@/lib/directEditLink/postDirectEditLinkHandler";

export const dynamic = "force-dynamic";

/**
 * Set or clear an artist link directly.
 *
 * @param request - The authenticated request.
 * @returns Success or a safe error.
 */
export async function POST(request: Request) {
  return postDirectEditLinkHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

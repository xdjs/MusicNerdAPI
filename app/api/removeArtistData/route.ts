import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postRemoveArtistDataHandler } from "@/lib/removeArtistData/postRemoveArtistDataHandler";

export const dynamic = "force-dynamic";

/**
 * Remove an artist link (admin only).
 *
 * @param request - The authenticated request.
 * @returns Success or a safe error.
 */
export async function POST(request: Request) {
  return postRemoveArtistDataHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

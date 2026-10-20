import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { patchHeaderPositionHandler } from "@/lib/headerPosition/patchHeaderPositionHandler";

export const dynamic = "force-dynamic";

/**
 * Update the header image Y position for an artist.
 *
 * @param request - The authenticated request.
 * @returns Success or a safe error.
 */
export async function PATCH(request: Request) {
  return patchHeaderPositionHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

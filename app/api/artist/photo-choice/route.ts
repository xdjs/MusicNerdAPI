import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPhotoChoiceHandler } from "@/lib/photoChoice/getPhotoChoiceHandler";
import { patchPhotoChoiceHandler } from "@/lib/photoChoice/patchPhotoChoiceHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/artist/photo-choice — returns the artist's custom image URL.
 *
 * @param request - Authenticated request with `?artistId=` query parameter.
 * @returns 200 with `{ status: "ok", customImage }`.
 */
export async function GET(request: Request) {
  return getPhotoChoiceHandler(request);
}

/**
 * PATCH /api/artist/photo-choice — sets or clears the custom image URL.
 *
 * @param request - Authenticated request with `{ artistId, customImage }`.
 * @returns 200 with `{ status: "ok" }`.
 */
export async function PATCH(request: Request) {
  return patchPhotoChoiceHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

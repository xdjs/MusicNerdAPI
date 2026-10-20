import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistBioHandler } from "@/lib/artistBio/getArtistBioHandler";
import { putArtistBioHandler } from "@/lib/artistBio/putArtistBioHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/artistBio/[id] — returns the artist's bio text.
 *
 * @param request - Authenticated request.
 * @param context - Route context with artist id.
 * @returns 200 with `{ status: "ok", bio }`.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getArtistBioHandler(request, (await context.params).id);
}

/**
 * PUT /api/artistBio/[id] — updates the artist's bio text.
 *
 * @param request - Authenticated request with `{ bio }`.
 * @param context - Route context with artist id.
 * @returns 200 with `{ status: "ok" }`.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return putArtistBioHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { getArtistImageRedirectHandler } from "@/lib/artistImage/getArtistImageRedirectHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Redirects to the artist's image: their upload, else their Spotify or Deezer portrait.
 *
 * @param request - The GET request.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 307 to the image, or an empty 400, 404 or 503.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistImageRedirectHandler(request, id);
}

/** Public preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { postSearchArtistsHandler } from "@/lib/artistSearch/postSearchArtistsHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/** Combined artist search across Music Nerd and Deezer, in MusicNerdWeb's shape.
 *
 * @param request - POST with `{ "query": string, "bookmarkedArtistIds"?: string[] }`.
 * @returns `{ results }`, or `{ error }` with 400, 408 or 500.
 */
export async function POST(request: Request) {
  return postSearchArtistsHandler(request);
}

/** Public search preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

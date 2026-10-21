import { postSearchArtistsBatchHandler } from "@/lib/artistSearch/postSearchArtistsBatchHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/** The best Music Nerd match per name, in MusicNerdWeb's shape.
 *
 * @param request - POST with `{ "query": { "artists": string[] } }` or `{ "query": { "artist": string } }`.
 * @returns `{ results }`, or `{ error }` with 400, 408 or 500.
 */
export async function POST(request: Request) {
  return postSearchArtistsBatchHandler(request);
}

/** Public preflight, 204 as MusicNerdWeb answered it.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyDataHandler } from "@/lib/spotifyData/getSpotifyDataHandler";
import { postSpotifyDataHandler } from "@/lib/spotifyData/postSpotifyDataHandler";

export const dynamic = "force-dynamic";

/** Spotify artist data for one `spotifyId`, or a comma-separated `spotifyIds`
 * batch of at most 50, in MusicNerdWeb's shape.
 *
 * @param request - GET with `?spotifyId=` or `?spotifyIds=a,b`.
 * @returns `{ data }`, or `{ error }` with 400, 502 or 503.
 */
export async function GET(request: Request) {
  return getSpotifyDataHandler(request);
}

/** Spotify artist data for a batch of at most 50 ids, in MusicNerdWeb's shape.
 *
 * @param request - POST with `{ "spotifyIds": string[] }`.
 * @returns `{ data }`, or `{ error }` with 400, 408 or 500.
 */
export async function POST(request: Request) {
  return postSpotifyDataHandler(request);
}

/** Public preflight, 204 as MusicNerdWeb answered it.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getTrackLinksHandler } from "@/lib/trackLinks/getTrackLinksHandler";

export const dynamic = "force-dynamic";

/** Where else a song or album can be heard: Apple Music and Deezer links that
 * are the same record, in MusicNerdWeb's shape.
 *
 * @param request - GET with `?title=&artist=` and optionally `&kind=album`.
 * @returns `{ links }` (`cached: true` from memory), or `{ error }` with 400.
 */
export async function GET(request: Request) {
  return getTrackLinksHandler(request);
}

/** Public preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

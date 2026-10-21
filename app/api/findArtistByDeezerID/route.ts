import { findArtistByDeezerIdHandler } from "@/lib/artistLookups/findArtistByDeezerIdHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/** Artist lookup: the artist with this Deezer ID, in MusicNerdWeb's shape,
 * with `bio` claim-checked.
 *
 * @param request - POST with `{ "deezerID": string }`.
 * @returns `{ result: artist }`, or a plain-text 400, 404 or 500.
 */
export async function POST(request: Request) {
  return findArtistByDeezerIdHandler(request);
}

/** Public lookup preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

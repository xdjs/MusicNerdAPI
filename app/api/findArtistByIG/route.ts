import { findArtistHandler } from "@/lib/artistLookups/findArtistHandler";
import { lookupArtists } from "@/lib/artistLookups/lookupArtists";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/** Artist lookup: the artist with this Instagram handle, in MusicNerdWeb's shape.
 *
 * @param request - POST with `{ "ig": string }`.
 * @returns `{ result: artist }`, or a plain-text 400, 404 or 500.
 */
export async function POST(request: Request) {
  return findArtistHandler(
    request,
    "ig",
    lookupArtists.instagram,
    "Missing or invalid required parameters: instagram handle",
  );
}
/** Public lookup preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

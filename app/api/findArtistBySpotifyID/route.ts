import { findLegacyArtistHandler } from "@/lib/legacyLookups/findLegacyArtistHandler";
import { legacyArtists } from "@/lib/legacyLookups/legacyArtists";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/** Legacy lookup kept for Sleeve Note: the artist with this Spotify ID, in MusicNerdWeb's shape.
 *
 * @param request - POST with `{ "spotifyID": string }`.
 * @returns `{ result: artist }`, or a plain-text 400, 404 or 500.
 */
export async function POST(request: Request) {
  return findLegacyArtistHandler(
    request,
    "spotifyID",
    legacyArtists.spotify,
    "Missing or invalid required parameters: spotifyID",
  );
}
/** Public lookup preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

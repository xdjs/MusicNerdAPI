import { findTwitterHandleHandler } from "@/lib/legacyLookups/findTwitterHandleHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/** Legacy lookup kept for Sleeve Note: an artist's X handle by ethAddress or name, in MusicNerdWeb's shape.
 *
 * @param request - POST with `{ "ethAddress"?: string, "name"?: string }`.
 * @returns `{ result: handle }` (or `{}` for an unmatched name), or a plain-text 400, 404 or 500.
 */
export async function POST(request: Request) {
  return findTwitterHandleHandler(request);
}
/** Public lookup preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { getArtistLatestHandler } from "@/lib/artistLatest/getArtistLatestHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/** Read stored public artist activity without initiating research.
 *
 * @param _request - Public read request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns Stored public activity or a safe error.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return getArtistLatestHandler((await context.params).id);
}
/** Public read preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

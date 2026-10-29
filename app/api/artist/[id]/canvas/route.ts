import { getCanvasBootstrap } from "@/lib/canvas/getCanvasBootstrap";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/** Read existing public evidence without generation.
 *
 * @param _request - Public read request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns Public artist identity and source cards, or a safe error.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return getCanvasBootstrap((await context.params).id);
}
/** Public read preflight; never triggers generation.
 *
 * @returns Empty CORS response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

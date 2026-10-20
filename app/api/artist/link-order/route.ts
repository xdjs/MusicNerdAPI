import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { putLinkOrderHandler } from "@/lib/linkOrder/putLinkOrderHandler";

export const dynamic = "force-dynamic";

/**
 * PUT /api/artist/link-order — upserts the display order of links in a section.
 *
 * @param request - Authenticated request with `{ artistId, section, order }`.
 * @returns 200 with `{ status: "ok" }`.
 */
export async function PUT(request: Request) {
  return putLinkOrderHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getFunFactsHandler } from "@/lib/funFacts/getFunFactsHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers and no body.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/funFacts/[type] — generate a fun fact about an artist.
 *
 * @param request - Authenticated request with `?id=artistId`.
 * @param context - Route context containing the fun fact type.
 * @param context.params - Promise resolving to the type parameter.
 * @returns 200 with `{ status: "ok", text }`.
 */
export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  return getFunFactsHandler(request, type);
}

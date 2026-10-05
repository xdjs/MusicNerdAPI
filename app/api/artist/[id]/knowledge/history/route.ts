import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistKnowledgeHandler } from "@/lib/knowledge/getArtistKnowledgeHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight for authenticated cross-origin clients.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Read exact artist answers and corrections with explicit memory limits.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The incoming request.
 * @param context - The route context.
 * @param context.params - The artist and optional source identity.
 * @returns Private knowledge or a typed validation, access, revision or storage error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistKnowledgeHandler(request, id, "history");
}

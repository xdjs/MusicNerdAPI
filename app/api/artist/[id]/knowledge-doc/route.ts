import { NextResponse } from "next/server";
import { getKnowledgeDocHandler } from "@/lib/knowledgeDoc/getKnowledgeDocHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 204 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Reads the artist's Lore document, its sources and the artist's corrections,
 * for the claimant or an admin.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, content, sources, corrections }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getKnowledgeDocHandler(request, id);
}

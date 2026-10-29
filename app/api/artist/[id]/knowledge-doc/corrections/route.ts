import { NextResponse } from "next/server";
import { postKnowledgeDocCorrectionHandler } from "@/lib/knowledgeDoc/postKnowledgeDocCorrectionHandler";
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
 * Marks a Lore claim wrong or replaces it with the artist's wording, then
 * queues a rebuild, for the claimant or an admin.
 *
 * @param request - The request; a claimant or admin Privy token and `{ claim, kind, correction? }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status: "ok" }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postKnowledgeDocCorrectionHandler(request, id);
}

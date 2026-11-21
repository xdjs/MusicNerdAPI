import { NextResponse } from "next/server";
import { deleteKnowledgeDocCorrectionHandler } from "@/lib/knowledgeDoc/deleteKnowledgeDocCorrectionHandler";
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
 * Undoes one Lore correction and queues a rebuild without it, for the
 * claimant or an admin.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id` and the `correctionId`.
 * @returns 200 with `{ status: "ok" }`, or an error.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; correctionId: string }> },
) {
  const { id, correctionId } = await context.params;
  return deleteKnowledgeDocCorrectionHandler(request, id, correctionId);
}

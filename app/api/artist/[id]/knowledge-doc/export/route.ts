import { NextResponse } from "next/server";
import { getKnowledgeDocExportHandler } from "@/lib/knowledgeExport/getKnowledgeDocExportHandler";
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
 * Downloads the artist's Lore document as Markdown, or its sources as CSV with
 * `?format=csv`, for the claimant or an admin.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with the file as an attachment, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getKnowledgeDocExportHandler(request, id);
}

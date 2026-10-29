import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistKnowledgeHandler } from "@/lib/knowledge/getArtistKnowledgeHandler";
import { deleteVaultSourcesHandler } from "@/lib/vaultSources/deleteVaultSourcesHandler";
import { postVaultSourceHandler } from "@/lib/vaultSources/postVaultSourceHandler";

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
 * List approved artist source metadata with revision-bound pagination.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The incoming request.
 * @param context - The route context.
 * @param context.params - The artist and optional source identity.
 * @returns Private knowledge or a typed validation, access, revision or storage error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistKnowledgeHandler(request, id, "sources");
}

/**
 * Add a web page to the artist's sources.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The request, with `{ url }`.
 * @param context - The route context.
 * @param context.params - The artist identity.
 * @returns 201 with the saved source, or a typed validation, access or conflict error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postVaultSourceHandler(request, id);
}

/**
 * Delete several of the artist's sources at once, all or nothing.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The request, with `{ sourceIds }`.
 * @param context - The route context.
 * @param context.params - The artist identity.
 * @returns 200 with the count deleted, or a typed validation, access or not-found error.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return deleteVaultSourcesHandler(request, id);
}

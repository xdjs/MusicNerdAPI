import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistKnowledgeHandler } from "@/lib/knowledge/getArtistKnowledgeHandler";
import { deleteVaultSourceHandler } from "@/lib/vaultSources/deleteVaultSourceHandler";
import { patchVaultSourceHandler } from "@/lib/vaultSources/patchVaultSourceHandler";

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
 * Read an original source window pinned to its current evidence revision.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The incoming request.
 * @param context - The route context.
 * @param context.params - The artist and optional source identity.
 * @returns Private knowledge or a typed validation, access, revision or storage error.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await context.params;
  return getArtistKnowledgeHandler(request, id, "read", sourceId);
}

/**
 * Approve or reject one of the artist's sources, or change its type.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The request, with `{ status?, expectedStatus?, type? }`.
 * @param context - The route context.
 * @param context.params - The artist and source identity.
 * @returns 200, or a typed validation, access, not-found or conflict error.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await context.params;
  return patchVaultSourceHandler(request, id, sourceId);
}

/**
 * Delete one of the artist's sources.
 * Requires the approved claimant or administrator's Privy bearer token.
 *
 * @param request - The request.
 * @param context - The route context.
 * @param context.params - The artist and source identity.
 * @returns 200, or a typed validation, access or not-found error.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await context.params;
  return deleteVaultSourceHandler(request, id, sourceId);
}

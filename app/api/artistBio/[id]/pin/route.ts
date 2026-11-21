import { NextResponse } from "next/server";
import { deleteArtistBioPinHandler } from "@/lib/bio/deleteArtistBioPinHandler";
import { putArtistBioPinHandler } from "@/lib/bio/putArtistBioPinHandler";
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
 * Pins a saved bio as the About, locked until unpinned, for the claimant or an admin.
 *
 * @param request - The request; a claimant or admin Privy token and `{ versionId }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status: "ok" }`, or an error.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return putArtistBioPinHandler(request, id);
}

/**
 * Unpins the artist's bio, for the claimant or an admin. The text is unchanged.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status: "ok" }`, or an error.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return deleteArtistBioPinHandler(request, id);
}

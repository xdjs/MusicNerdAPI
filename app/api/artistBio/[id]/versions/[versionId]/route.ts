import { NextResponse } from "next/server";
import { deleteArtistBioVersionHandler } from "@/lib/bio/deleteArtistBioVersionHandler";
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
 * Deletes one saved bio, unless it is pinned, for the claimant or an admin.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id` and the `versionId`.
 * @returns 200 with `{ status: "ok" }`, or an error.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await context.params;
  return deleteArtistBioVersionHandler(request, id, versionId);
}

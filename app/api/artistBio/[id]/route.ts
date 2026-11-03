import { NextResponse } from "next/server";
import { getArtistBioHandler } from "@/lib/bio/getArtistBioHandler";
import { putArtistBioHandler } from "@/lib/bio/putArtistBioHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 204 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Reads the artist's About as the profile shows it. With `?regenerate=true`,
 * the claimant or an admin prepares missing/pending Lore, then rewrites About.
 *
 * @param request - The request; a claimant or admin Privy token when regenerating.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, bio, publicAbout }` or the regenerated bio, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistBioHandler(request, id);
}

/**
 * Saves the About the claimant or an admin wrote, or prepares Lore and regenerates About.
 *
 * @param request - The request; a claimant or admin Privy token and `{ bio }` or `{ regenerate: true }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, message, bio? }`, or an error.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return putArtistBioHandler(request, id);
}

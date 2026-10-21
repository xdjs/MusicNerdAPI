import { NextResponse } from "next/server";
import { getDirectoryDiscoveryHandler } from "@/lib/directoryDiscovery/getDirectoryDiscoveryHandler";
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
 * The state of the research started by adding the artist to the directory,
 * for the adding account or an admin, and a fingerprint of the public links.
 *
 * @param request - The request; a Privy token.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, state, revision }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getDirectoryDiscoveryHandler(request, id);
}

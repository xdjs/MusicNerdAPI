import { NextResponse } from "next/server";
import { getPendingSubmissionsHandler } from "@/lib/contributorApprovals/getPendingSubmissionsHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The contributor's pending link suggestions and Lore sources, oldest first.
 *
 * @param request - The request; an admin's Privy token.
 * @param context - The route context.
 * @param context.params - Holds the contributor's user `id`.
 * @returns 200 with `{ status, items, hasMore }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getPendingSubmissionsHandler(request, id);
}

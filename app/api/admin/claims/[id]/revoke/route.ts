import { NextResponse } from "next/server";
import { postRevokeClaimHandler } from "@/lib/claims/postRevokeClaimHandler";
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
 * Revokes an approved claim and deletes what its claimant added.
 *
 * @param request - The request; an admin's Privy token.
 * @param context - The route context.
 * @param context.params - Holds the claim `id`.
 * @returns 200 with `{ status }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postRevokeClaimHandler(request, id);
}

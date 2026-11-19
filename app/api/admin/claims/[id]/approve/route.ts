import { NextResponse } from "next/server";
import { postApproveClaimHandler } from "@/lib/claims/postApproveClaimHandler";
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
 * Approves a claim and starts the claimant's page.
 *
 * @param request - The request; an admin's Privy token.
 * @param context - The route context.
 * @param context.params - Holds the claim `id`.
 * @returns 200 with `{ status, warning? }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postApproveClaimHandler(request, id);
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postDismissLegacyLinkHandler } from "@/lib/users/postDismissLegacyLinkHandler";

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
 * Stops the prompt to link an older wallet-based account.
 *
 * @param request - The request; a Privy token for the account `id`.
 * @param context - The route context.
 * @param context.params - Holds the account `id`.
 * @returns 200 with `{ status }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postDismissLegacyLinkHandler(request, id);
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postUserNamePromptHandler } from "@/lib/users/postUserNamePromptHandler";

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
 * Records the one-time user-name prompt and says whether to show it now.
 *
 * @param request - The request; a Privy token for the account `id`.
 * @param context - The route context.
 * @param context.params - Holds the account `id`.
 * @returns 200 with `{ status, showPrompt }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postUserNamePromptHandler(request, id);
}

import { NextResponse } from "next/server";
import { postLinkWalletHandler } from "@/lib/account/postLinkWalletHandler";
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
 * Links a wallet the signed-in user owns in Privy to their account, merging a
 * legacy account that already has it.
 *
 * @param request - The request; a signed-in user's Privy token and `{ walletAddress }`.
 * @returns 200 with `{ status, success, merged, userId?, message }`, or an error.
 */
export async function POST(request: Request) {
  return postLinkWalletHandler(request);
}

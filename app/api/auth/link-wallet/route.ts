import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postLinkWalletHandler } from "@/lib/user/postLinkWalletHandler";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/link-wallet — link a wallet and merge legacy accounts.
 *
 * @param request - The incoming request with wallet details.
 * @returns 200 on success, 4xx on validation failure.
 */
export async function POST(request: Request) {
  return postLinkWalletHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postLinkWalletHandler } from "@/lib/user/postLinkWalletHandler";

export const dynamic = "force-dynamic";

/** Link a verified wallet to the authenticated user, merging legacy accounts. */
export async function POST(request: Request) {
  return postLinkWalletHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

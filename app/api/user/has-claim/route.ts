import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getHasClaimHandler } from "@/lib/user/getHasClaimHandler";

export const dynamic = "force-dynamic";

/** Check whether the authenticated user has an approved artist claim. */
export async function GET(request: Request) {
  return getHasClaimHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

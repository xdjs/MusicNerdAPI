import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileArtistsHandler } from "@/lib/profile/getProfileArtistsHandler";

export const dynamic = "force-dynamic";

/** Paginated list of artists the authenticated user has contributed to. */
export async function GET(request: Request) {
  return getProfileArtistsHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

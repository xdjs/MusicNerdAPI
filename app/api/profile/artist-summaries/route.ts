import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSummariesHandler } from "@/lib/profile/getArtistSummariesHandler";

export const dynamic = "force-dynamic";

/** Return claimed artist bios for a small set of IDs. */
export async function GET(request: Request) {
  return getArtistSummariesHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

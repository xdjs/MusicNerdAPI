import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileSummaryHandler } from "@/lib/profile/getProfileSummaryHandler";

export const dynamic = "force-dynamic";

/** The authenticated user's contribution summary (UGC stats, recent entries). */
export async function GET(request: Request) {
  return getProfileSummaryHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileUpdatesHandler } from "@/lib/profile/getProfileUpdatesHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Paginated profile update feed across contributed artists. */
export async function GET(request: Request) {
  return getProfileUpdatesHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

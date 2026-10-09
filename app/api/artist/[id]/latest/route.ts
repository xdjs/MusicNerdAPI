import { getArtistLatestHandler } from "@/lib/artistLatest/getArtistLatestHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/** Read stored public artist activity without initiating research. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return getArtistLatestHandler((await context.params).id);
}
/** Public read preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

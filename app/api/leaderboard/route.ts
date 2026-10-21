import { getLeaderboardHandler } from "@/lib/leaderboard/getLeaderboardHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/** The contributor leaderboard, all-time or within a period, in MusicNerdWeb's shape.
 *
 * @param request - GET with optional `?from=&to=` and `?page=&perPage=`.
 * @returns The entries as an array, `{ entries, total, pageCount }` when paginated, or 500 `{ error, details }`.
 */
export async function GET(request: Request) {
  return getLeaderboardHandler(request);
}

/** Public preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

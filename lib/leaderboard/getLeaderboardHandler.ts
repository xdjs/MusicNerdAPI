import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard/getLeaderboard";
import { getLeaderboardInRange } from "@/lib/leaderboard/getLeaderboardInRange";
import { validateLeaderboardQuery } from "@/lib/leaderboard/validateLeaderboardQuery";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserDisplayName } from "@/lib/users/getUserDisplayName";

/**
 * Handles GET /api/leaderboard with MusicNerdWeb's shapes: the ranked entries
 * as an array, or `{ entries, total, pageCount }` when paginated. The query
 * helpers also serve an admin view, so the public projection is made here:
 * `username` is the display name and `email` and `wallet` are always null.
 *
 * @param request - The GET request.
 * @returns 200 with the entries, or 500 `{ error, details }`.
 */
export async function getLeaderboardHandler(request: Request): Promise<Response> {
  const headers = getCorsHeaders();
  try {
    const { searchParams } = new URL(request.url);
    const { from, to, page, perPage, isPaginated } = validateLeaderboardQuery(searchParams);
    const ranked = from && to ? await getLeaderboardInRange(from, to) : await getLeaderboard();
    const leaderboard = ranked.map(entry => ({
      ...entry,
      username: getUserDisplayName(entry),
      email: null,
      wallet: null,
    }));
    if (isPaginated) {
      const total = leaderboard.length;
      const pageCount = Math.ceil(total / perPage);
      const offset = (page - 1) * perPage;
      const entries = leaderboard.slice(offset, offset + perPage);
      return NextResponse.json({ entries, total, pageCount }, { status: 200, headers });
    }
    return NextResponse.json(leaderboard, { status: 200, headers });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers },
    );
  }
}

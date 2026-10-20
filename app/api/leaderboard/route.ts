import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getLeaderboard } from "@/lib/leaderboard/getLeaderboard";
import { getLeaderboardInRange } from "@/lib/leaderboard/getLeaderboardInRange";
import { getUserDisplayName } from "@/lib/user/getUserDisplayName";

export const dynamic = "force-dynamic";

/**
 * CORS preflight for the leaderboard endpoint.
 *
 * @returns Empty 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * User contribution leaderboard, with optional date range and pagination.
 *
 * @param request - GET with optional `?from=&to=` and `?page=&perPage=`.
 * @returns Leaderboard entries with PII stripped.
 */
export async function GET(request: Request) {
  const headers = getCorsHeaders();
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let leaderboard = from && to ? await getLeaderboardInRange(from, to) : await getLeaderboard();

    // Project a safe public response — hide PII.
    leaderboard = leaderboard.map(entry => ({
      ...entry,
      username: getUserDisplayName(entry),
      email: null,
      wallet: null,
    }));

    // Pagination parameters
    const pageParam = parseInt(searchParams.get("page") ?? "", 10);
    const perPageParam = parseInt(searchParams.get("perPage") ?? "10", 10);
    const perPage = Number.isFinite(perPageParam) && perPageParam > 0 ? perPageParam : 10;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const isPaginated = searchParams.has("page") || searchParams.has("perPage");

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
  } finally {
    const end = performance.now();
    console.debug(`[leaderboard] GET took ${end - start}ms`);
  }
}
